// Turns the end-of-run state into a score, breakdown, and title.

const TITLES = [
  { min: 1300, title: 'Campus Legend' },
  { min: 1050, title: 'Campus Deputy' },
  { min: 800, title: 'Hall Monitor' },
  { min: 0, title: 'Rookie' },
];

export function computeResult({
  arrivalMinutes,
  bellMinutes,
  calories,
  caffeineMg,
  goals,
  gotFavorite,
  infractions,
  amandaMood,
}) {
  const onTime = arrivalMinutes !== null && arrivalMinutes < bellMinutes;
  if (!onTime) return { onTime: false, score: 0, title: 'Tardy', lines: [], perfect: false };

  const lines = [];
  const add = (label, detail, points) => lines.push({ label, detail, points });

  const early = Math.floor(bellMinutes - arrivalMinutes);
  add('On time', `${early} min early`, 500 + early * 20);

  const foodMet = calories >= goals.minCalories;
  add('Breakfast', `${calories} / ${goals.minCalories} cal`,
    foodMet ? 300 : Math.round((300 * calories) / goals.minCalories) - 100);

  const caffeineMet = caffeineMg >= goals.minCaffeineMg;
  add('Caffeine', `${caffeineMg} / ${goals.minCaffeineMg} mg`,
    caffeineMet ? 200 : Math.round((200 * caffeineMg) / goals.minCaffeineMg));

  if (gotFavorite) add('Root Beer Ghost', 'favorite flavor', 100);
  if (infractions > 0) add('Infractions', `x${infractions}`, -50 * infractions);
  if (amandaMood !== 0) add("Amanda's mood", amandaMood > 0 ? `+${amandaMood}` : `${amandaMood}`, amandaMood * 25);

  const score = Math.max(0, lines.reduce((s, l) => s + l.points, 0));
  const perfect = foodMet && caffeineMet && infractions === 0;
  const title = TITLES.find((t) => score >= t.min).title;
  return { onTime: true, score, title, lines, perfect };
}
