// Wawa shopping rules: food calories and caffeine goals.

export function makeFood(item) {
  return { type: 'food', id: item.id, name: item.name, calories: item.calories, paid: false };
}

export function makeGhost(flavor, caffeineMg) {
  return { type: 'drink', name: `Ghost Energy (${flavor})`, flavor, caffeineMg, calories: 0, paid: false };
}

export function totals(inventory) {
  let calories = 0;
  let caffeineMg = 0;
  for (const item of inventory) {
    if (item.type === 'food') calories += item.calories;
    if (item.type === 'drink') caffeineMg += item.caffeineMg;
  }
  return { calories, caffeineMg };
}

export function goalStatus(inventory, goals) {
  const { calories, caffeineMg } = totals(inventory);
  return {
    calories,
    caffeineMg,
    foodMet: calories >= goals.minCalories,
    caffeineMet: caffeineMg >= goals.minCaffeineMg,
  };
}

export function hasUnpaid(inventory) {
  return inventory.some((i) => !i.paid);
}

// Returns menu items that break the minimum-calorie rule (should be empty).
export function invalidMenuItems(menu, minCalories) {
  return menu.food.filter((f) => f.calories < minCalories);
}
