<script setup lang="ts">
import { toBlob } from 'html-to-image'
import { presentShareTrip, type ShareFormat, type ShareStory } from '~/utils/sharePresenter'
import { recordLocalEvent } from '~/utils/localEvents'

const store = useTripStore()
const isOpen = ref(false)
const story = ref<ShareStory>('overview')
const format = ref<ShareFormat>('portrait')
const includeTripName = ref(false)
const includeSafeDetails = ref(false)
const generating = ref(false)
const failed = ref(false)
const copied = ref(false)
const previewUrls = ref<string[]>([])
const blobs = shallowRef<Blob[]>([])
const currentPage = ref(0)
const customQuestion = ref('')
let previousFocus: HTMLElement | null = null
const presented = computed(() => presentShareTrip(store, story.value, { includeTripName: includeTripName.value, includeSafeDetails: includeSafeDetails.value }))
const caption = computed(() => customQuestion.value.trim() ? `${customQuestion.value.trim()}\n\n${presented.value.caption.split('\n\n').slice(1).join('\n\n')}` : presented.value.caption)

function slugify(value: string) { return value.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'orlando-trip' }
function revokePreviews() { previewUrls.value.forEach((url) => URL.revokeObjectURL(url)); previewUrls.value = [] }
let token = 0
async function generate() {
  generating.value = true; failed.value = false; currentPage.value = 0
  const request = ++token
  await nextTick(); await document.fonts?.ready
  const elements = [...document.querySelectorAll<HTMLElement>('.share-offscreen .share-card')]
  const nextBlobs: Blob[] = []
  for (const element of elements) {
    try { const blob = await toBlob(element, { pixelRatio: 1, skipFonts: true }); if (blob) nextBlobs.push(blob) } catch { /* handled below */ }
  }
  if (request !== token) return
  revokePreviews(); blobs.value = nextBlobs; previewUrls.value = nextBlobs.map((blob) => URL.createObjectURL(blob)); failed.value = nextBlobs.length !== presented.value.pages.length; generating.value = false
  if (!failed.value) recordLocalEvent('share_preview_generated')
}
function open() { previousFocus = document.activeElement as HTMLElement | null; isOpen.value = true; story.value = 'overview'; includeTripName.value = false; includeSafeDetails.value = false; nextTick(() => { document.querySelector<HTMLElement>('.share-studio>header button')?.focus(); generate() }) }
function close() { isOpen.value = false; revokePreviews(); blobs.value = []; nextTick(() => previousFocus?.focus()) }
watch([story, format, includeTripName, includeSafeDetails], () => { if (isOpen.value) generate() })
watch(story, () => { if (isOpen.value) recordLocalEvent('share_story_selected') })

function files() { return blobs.value.map((blob, index) => new File([blob], `${slugify(includeTripName.value ? store.displayName : 'orlando-trip')}-${story.value}-${index + 1}.png`, { type: 'image/png' })) }
async function shareOrDownload() {
  const output = files(); if (!output.length) return
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: output })) {
    try { recordLocalEvent('share_native_opened'); await navigator.share({ files: output, title: 'Orlando trip plan', text: caption.value }); return } catch { /* fall back to download */ }
  }
  output.forEach((file) => { const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })
  recordLocalEvent('share_downloaded')
}
async function copyCaption() { await navigator.clipboard.writeText(caption.value); recordLocalEvent('share_caption_copied'); copied.value = true; setTimeout(() => { copied.value = false }, 1600) }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') close() }
watch(isOpen, (openNow) => { if (typeof window !== 'undefined') openNow ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey) })
onBeforeUnmount(() => { revokePreviews(); if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey) })
defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="share-root">
      <div class="share-scrim" @click="close" />
      <section class="share-studio" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header><div><p class="eyebrow">Social Share Studio</p><h2 id="share-title">Make a post-ready trip image</h2></div><button type="button" aria-label="Close" @click="close">×</button></header>
        <div class="share-studio__body">
          <fieldset><legend>What are you sharing?</legend><div class="story-grid"><label v-for="item in [{id:'overview',label:'My trip overview'},{id:'weeks',label:'Week by week'},{id:'pacing',label:'How does this pacing look?'}]" :key="item.id"><input v-model="story" type="radio" :value="item.id" /><span>{{ item.label }}</span></label></div></fieldset>
          <fieldset><legend>Image size</legend><div class="inline"><label><input v-model="format" type="radio" value="portrait" /> Portrait 1080 × 1350</label><label><input v-model="format" type="radio" value="square" /> Square 1080 × 1080</label></div></fieldset>
          <section class="privacy"><h3>Privacy review</h3><p>Included: {{ presented.included.join(', ') }}.</p><p>Always hidden: {{ presented.excluded.join(', ') }}.</p><label><input v-model="includeTripName" type="checkbox" /> Include the real trip name</label><label><input v-model="includeSafeDetails" type="checkbox" /> Include safe summaries such as “Dining booked”</label></section>
          <label class="question"><span>Post question or caption opener</span><input v-model="customQuestion" class="input" :placeholder="story === 'pacing' ? 'How does this pacing look?' : 'What would you change?'" /></label>
          <div class="preview" :class="`preview--${format}`">
            <div v-if="generating" class="preview__state">Generating {{ presented.pages.length }} image{{ presented.pages.length === 1 ? '' : 's' }}…</div>
            <img v-else-if="previewUrls[currentPage]" :src="previewUrls[currentPage]" alt="Trip share image preview" />
            <div v-else class="preview__state">Preview unavailable.</div>
          </div>
          <div v-if="previewUrls.length > 1" class="pager"><button type="button" :disabled="currentPage === 0" @click="currentPage--">←</button><span>Image {{ currentPage + 1 }} of {{ previewUrls.length }}</span><button type="button" :disabled="currentPage === previewUrls.length - 1" @click="currentPage++">→</button></div>
          <p v-if="failed" class="error">One or more images could not be generated. Try again.</p>
          <div class="caption"><p>{{ caption }}</p><button type="button" @click="copyCaption">{{ copied ? 'Copied' : 'Copy caption' }}</button></div>
        </div>
        <footer><button type="button" class="ghost" @click="close">Close</button><button type="button" class="cta" :disabled="!blobs.length || generating" @click="shareOrDownload">Share / download {{ blobs.length || '' }}</button></footer>
      </section>
    </div>
    <div v-if="isOpen" class="share-offscreen" aria-hidden="true"><ShareCard v-for="page in presented.pages" :key="`${story}-${format}-${page.number}`" :page="page" :format="format" /></div>
  </Teleport>
</template>

<style scoped>
.share-offscreen{position:fixed;left:-9999px;top:0;pointer-events:none}.share-root{position:fixed;inset:0;z-index:90}.share-scrim{position:absolute;inset:0;background:rgba(9,26,51,.5)}.share-studio{position:absolute;inset:4vh max(12px,calc((100vw - 680px)/2));display:flex;flex-direction:column;background:var(--paper);border-radius:20px;overflow:hidden;box-shadow:0 25px 70px rgba(9,26,51,.3)}.share-studio>header{display:flex;justify-content:space-between;padding:18px 20px 12px;border-bottom:1px solid var(--warm-rule)}.share-studio h2{margin:3px 0 0;font-size:22px}.share-studio>header button{font-size:28px;color:var(--text-muted)}.share-studio__body{flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:17px}fieldset{border:0;padding:0}legend,.question>span{display:block;margin-bottom:8px;font-size:13px;font-weight:700}.story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.story-grid label,.inline label{padding:10px;border:1px solid var(--warm-border);border-radius:10px;font-size:12px}.story-grid input{display:block;margin-bottom:6px}.inline{display:flex;flex-wrap:wrap;gap:7px}.privacy{padding:12px;border-radius:12px;background:#f1f4f7}.privacy h3{font-size:14px}.privacy p{font-size:12px;color:var(--text-muted);margin-top:4px}.privacy label{display:block;margin-top:8px;font-size:13px}.question .input{width:100%}.preview{align-self:center;width:min(100%,330px);aspect-ratio:1080/1350;border:1px solid var(--warm-border);border-radius:12px;overflow:hidden;background:var(--sand);display:grid;place-items:center}.preview--square{aspect-ratio:1}.preview img{width:100%;height:100%;object-fit:contain}.preview__state{font-size:13px;color:var(--text-faint)}.pager{display:flex;justify-content:center;gap:18px;align-items:center;font-size:12px}.pager button{font-size:18px}.pager button:disabled{opacity:.3}.caption{padding:12px;border:1px solid var(--warm-border);border-radius:12px;white-space:pre-line;font-size:13px}.caption button{margin-top:8px;color:var(--c-navy);font-weight:700}.error{color:var(--warn-ink);font-size:12px}.share-studio>footer{display:flex;gap:10px;padding:12px 20px max(14px,env(safe-area-inset-bottom));border-top:1px solid var(--warm-rule)}.share-studio>footer button{flex:1}.ghost{background:#eef0f4;border-radius:10px;font-weight:700}@media(max-width:600px){.share-studio{inset:3vh 0 0;border-radius:20px 20px 0 0}.story-grid{grid-template-columns:1fr}.share-studio__body{padding-inline:16px}}
</style>
