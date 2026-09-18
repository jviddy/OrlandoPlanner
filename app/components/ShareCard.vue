<script setup lang="ts">
import type { ShareFormat, SharePage } from '~/utils/sharePresenter'
import { parkName } from '~/data/parks'
import { parseISO, useDates } from '~/composables/useDates'

const props = defineProps<{ page: SharePage; format: ShareFormat }>()
const { dow } = useDates()
function dateNumber(date: string) { return parseISO(date).getUTCDate() }
function label(parkId: string | null, secondParkId: string | null) {
  if (!parkId) return 'Not set'
  const first = parkName(parkId)
  return secondParkId ? `${first} + ${parkName(secondParkId)}` : first
}
</script>

<template>
  <div class="share-card" :class="`share-card--${format}`">
    <header class="share-card__head">
      <p class="share-card__eyebrow">Orlando trip plan</p>
      <h1>{{ page.story === 'pacing' ? 'How does this pacing look?' : page.story === 'choice' ? 'Help us choose' : page.story === 'countdown' ? 'Our Orlando countdown' : page.title }}</h1>
      <p>{{ page.range }}</p>
    </header>

    <div v-if="page.facts.length" class="share-facts"><strong v-for="fact in page.facts" :key="fact">{{ fact }}</strong></div>

    <div v-if="page.story !== 'weeks'" class="share-grid" :class="{ 'share-grid--choice': page.story === 'choice' }">
      <div v-for="day in page.days" :key="day.id" class="share-cell">
        <DayCircle :park-id="day.parkId" :second-park-id="day.secondParkId" :date-number="dateNumber(day.date)" :size="68" flat />
        <strong>{{ label(day.parkId, day.secondParkId) }}</strong>
      </div>
    </div>

    <div v-else class="share-rows">
      <div v-for="day in page.days" :key="day.id" class="share-row">
        <div class="share-row__date"><span>{{ dow(parseISO(day.date)) }}</span><strong>{{ dateNumber(day.date) }}</strong></div>
        <DayCircle :park-id="day.parkId" :second-park-id="day.secondParkId" :size="54" flat />
        <div class="share-row__body"><strong>{{ label(day.parkId, day.secondParkId) }}</strong><span v-for="summary in day.summaries" :key="summary">{{ summary }}</span></div>
      </div>
    </div>

    <footer><span>orlandoplanner.app</span><span v-if="page.total > 1">{{ page.number }} / {{ page.total }}</span></footer>
  </div>
</template>

<style scoped>
.share-card{width:1080px;height:1350px;box-sizing:border-box;padding:56px 64px;background:#fffdf8;color:#16233c;display:flex;flex-direction:column;font-family:Arial,sans-serif}.share-card--square{height:1080px}.share-card__head{margin-bottom:32px}.share-card__eyebrow{font-size:18px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#687386}.share-card h1{font:700 58px/1.05 Georgia,serif;margin:9px 0 8px}.share-card__head>p:last-child{font-size:24px;color:#687386}
.share-grid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);align-content:start;gap:22px 9px}.share-cell{text-align:center;min-width:0}.share-cell strong{display:block;margin-top:9px;font-size:15px;line-height:1.15;overflow-wrap:anywhere}.share-rows{flex:1;display:flex;flex-direction:column;gap:13px}.share-row{display:flex;align-items:center;gap:20px;padding:16px 22px;border:2px solid #e5dece;border-radius:20px;background:#fff}.share-row__date{width:52px;text-align:center;color:#687386}.share-row__date span,.share-row__date strong{display:block}.share-row__date strong{font-size:27px;color:#16233c}.share-row__body{display:flex;flex-direction:column;gap:3px}.share-row__body strong{font-size:23px}.share-row__body span{font-size:17px;color:#687386}
.share-grid--choice{grid-template-columns:repeat(2,1fr);gap:30px}.share-grid--choice .share-cell{padding:80px 20px}.share-grid--choice .share-cell strong{font-size:28px}.share-facts{display:flex;gap:18px;margin-bottom:30px}.share-facts strong{flex:1;padding:24px;border-radius:20px;background:#eef3f8;text-align:center;font-size:28px;color:#17365f}
footer{margin-top:24px;display:flex;justify-content:center;gap:20px;font-size:16px;color:#687386}footer span:last-child:not(:first-child){margin-left:auto}
.share-card--square{padding-block:45px}.share-card--square .share-card__head{margin-bottom:22px}.share-card--square h1{font-size:48px}.share-card--square .share-grid{gap:12px 8px}.share-card--square .share-row{padding-block:10px}
</style>
