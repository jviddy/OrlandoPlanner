<script setup lang="ts">
import { toBlob } from 'html-to-image'
import type { ShareMode } from './ShareCard.vue'

const store = useTripStore()

const isOpen = ref(false)
const mode = ref<ShareMode>('overview')
const generating = ref(false)
const shareFailed = ref(false)
const previewUrl = ref('')
const previewBlob = shallowRef<Blob | null>(null)
const cardRef = ref<{ $el?: HTMLElement } | null>(null)

const MODES: { value: ShareMode; label: string; hint: string }[] = [
  { value: 'overview', label: 'Overview', hint: 'Just the parks' },
  { value: 'extended', label: 'Extended', hint: 'Adds meals & activities' },
  { value: 'list', label: 'List', hint: 'A simple day-by-day list' },
]

function slugify(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'trip'
}

let generationToken = 0
async function generate() {
  generating.value = true
  shareFailed.value = false
  const token = ++generationToken
  // Let the off-screen card re-render for the new mode before capturing it.
  await nextTick()
  await new Promise((r) => setTimeout(r, 60))
  const el = cardRef.value?.$el
  if (!(el instanceof HTMLElement)) {
    generating.value = false
    return
  }
  let blob: Blob | null = null
  try {
    // The card only uses the two Google Fonts already loaded on the page (no
    // custom @font-face rules of its own), and html-to-image can't embed
    // that stylesheet cross-origin anyway (logs a CORS error and moves on)
    // — skip the attempt so it doesn't waste time or console-spam.
    blob = await toBlob(el, { pixelRatio: 1, skipFonts: true })
  } catch {
    blob = null
  }
  if (token !== generationToken) return // superseded by a later mode switch
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewBlob.value = blob
  previewUrl.value = blob ? URL.createObjectURL(blob) : ''
  generating.value = false
}

function open() {
  isOpen.value = true
  mode.value = 'overview'
  generate()
}
function close() {
  isOpen.value = false
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewBlob.value = null
}
watch(mode, () => {
  if (isOpen.value) generate()
})

async function shareOrSave() {
  const blob = previewBlob.value
  if (!blob) return
  const filename = `${slugify(store.displayName)}-${mode.value}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: store.displayName })
      return
    } catch {
      // Cancelled or failed — fall through to a plain download instead.
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    shareFailed.value = true
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
watch(isOpen, (open) => {
  if (typeof window === 'undefined') return
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="isOpen" class="sheet-root">
        <div class="sheet-scrim" @click="close" />
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Share this trip">
          <div class="sheet__handle" />
          <div class="sheet__head">
            <p class="sheet__title">Share this trip</p>
            <p class="sheet__sub">Creates an image — save it, or share it straight to Photos, Messages or Facebook.</p>
          </div>

          <div class="sheet__body">
            <div class="modes">
              <button
                v-for="m in MODES"
                :key="m.value"
                type="button"
                class="modes__btn"
                :class="{ 'modes__btn--on': mode === m.value }"
                @click="mode = m.value"
              >
                <span class="modes__label">{{ m.label }}</span>
                <span class="modes__hint">{{ m.hint }}</span>
              </button>
            </div>

            <div class="preview">
              <div v-if="generating" class="preview__loading">Generating…</div>
              <img v-else-if="previewUrl" :src="previewUrl" alt="" class="preview__img" />
              <div v-else class="preview__loading">Couldn't generate a preview.</div>
            </div>
            <p v-if="shareFailed" class="preview__error">
              Couldn't share or save that automatically — try again, or take a screenshot of
              the preview above.
            </p>
          </div>

          <div class="sheet__foot">
            <button type="button" class="sheet__btn sheet__btn--ghost" @click="close">
              Close
            </button>
            <button
              type="button"
              class="sheet__btn sheet__btn--go"
              :disabled="!previewBlob"
              @click="shareOrSave"
            >
              Share / Save
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Rendered off-screen at full export size purely so html-to-image has real
         layout to rasterize; never visible to the person using the app. -->
    <div v-if="isOpen" class="offscreen" aria-hidden="true">
      <ShareCard ref="cardRef" :mode="mode" />
    </div>
  </Teleport>
</template>

<style scoped>
.offscreen {
  position: fixed;
  top: 0;
  left: -9999px;
  pointer-events: none;
}

.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.sheet-scrim {
  position: absolute;
  inset: 0;
  background: rgba(12, 16, 26, 0.42);
  animation: fadeIn 0.15s ease;
}
.sheet {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 100%;
  max-width: var(--app-max);
  transform: translateX(-50%);
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 8px 0 max(26px, env(safe-area-inset-bottom));
  max-height: 88%;
  display: flex;
  flex-direction: column;
  animation: sheetUp 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.sheet__handle {
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: #dfe3ec;
  margin: 6px auto 10px;
}
.sheet__head {
  padding: 0 20px 10px;
}
.sheet__title {
  font: 700 18px var(--font-display);
  color: var(--text);
}
.sheet__sub {
  font-size: 12.5px;
  color: var(--text-faint);
  margin-top: 2px;
  line-height: 1.4;
}
.sheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 0;
}
.sheet__foot {
  padding: 10px 20px 0;
  display: flex;
  gap: 10px;
}
.sheet__btn {
  flex: 1;
  padding: 13px;
  border-radius: var(--r-sheet-tile);
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.06s ease;
}
.sheet__btn:active {
  transform: scale(0.98);
}
.sheet__btn--ghost {
  background: #f2f4f9;
  color: var(--text-muted);
}
.sheet__btn--go {
  background: var(--c-navy);
  color: #fff;
}
.sheet__btn--go:disabled {
  background: #c2c8d6;
  cursor: not-allowed;
}

.modes {
  display: flex;
  gap: 8px;
}
.modes__btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 8px;
  border-radius: var(--r-sheet-tile);
  background: #f2f4f9;
  border: 1.5px solid transparent;
  text-align: left;
}
.modes__btn--on {
  background: var(--tile-selected);
  border-color: var(--c-navy);
}
.modes__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.modes__hint {
  font-size: 10.5px;
  color: var(--text-faint);
  line-height: 1.2;
}

.preview {
  margin-top: 14px;
  border-radius: var(--r-card);
  overflow: hidden;
  background: var(--sand);
  border: 1px solid var(--warm-border);
  aspect-ratio: 1080 / 1350;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.preview__loading {
  font-size: 13px;
  color: var(--text-faint);
}
.preview__error {
  font-size: 12px;
  color: var(--warn-ink);
  margin-top: 8px;
}

.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-leave-to {
  opacity: 0;
}
</style>
