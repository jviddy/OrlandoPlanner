// Orlando International Airport, 1991–2020 monthly normals; °F and inches.
// https://climatecenter.fsu.edu/products-services/data/1991-2020-normals/orlando
export const climateSource = 'https://climatecenter.fsu.edu/products-services/data/1991-2020-normals/orlando'
// Published mean temperatures, compared with the annual mean of 73°F (22.8°C).
const monthlyMeans = [60.6, 63.6, 67.3, 72.2, 77.3, 81.2, 82.6, 82.6, 81.0, 75.5, 68.2, 63.3]
export function matchesTemperaturePreference(month: number, preference: 'cool' | 'warm') {
  return preference === 'cool' ? monthlyMeans[month]! < 73 : monthlyMeans[month]! > 73
}
const normals = [
  [71.8, 49.5, 2.48], [74.9, 52.4, 2.04], [78.9, 55.8, 3.03],
  [83.6, 60.7, 2.58], [88.4, 66.3, 4.02], [90.8, 71.6, 8.05],
  [92.0, 73.2, 7.46], [91.6, 73.7, 7.69], [89.6, 72.4, 6.37],
  [84.7, 66.2, 3.46], [78.3, 58.2, 1.79], [73.8, 52.9, 2.48],
] as const
export function climateLabel(month: number) {
  const [high, low, rain] = normals[month]!
  return `${Math.round((high - 32) * 5 / 9)}° / ${Math.round((low - 32) * 5 / 9)}°C · ${Math.round(rain * 25.4)} mm/month`
}
export function climateTemperature(month: number, kind: 'high' | 'low') {
  return (normals[month]![kind === 'high' ? 0 : 1] - 32) * 5 / 9
}
