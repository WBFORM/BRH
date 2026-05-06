const bossData = [
  { id: 1, nameEn: "Tung Tung Tung Assasino Boneka", nameRu: "Тунг Тунг Тунг Ассасино Бонека", week: 1, image: "tung-tung-tung-assasino-boneka.jpg", description: "Tung Tung Tung Assasino Boneka - Тунг Тунг Тунг Ассасино Бонека\nСочетание трёх персонажей: Тунг-Тунг-Тунг Сахура, Капучино Ассассино и Бонека Амбалабу." },
  { id: 2, nameEn: "Kudanile Astronote", nameRu: "Куданиле Астронавт", week: 2, image: "kudanile-astronote.jpg", description: "Kudanile Astronote - Куданиле Астронавт\nБегемот-астронавт с телом арбуза." },
  { id: 3, nameEn: "Penguinator Termoregulator", nameRu: "Пингвинатор Терморегулятор", week: 3, image: "penguinator-termoregulator.jpg", description: "Penguinator Termoregulator - Пингвинатор Терморегулятор\nПингвин-кондиционер." },
];

function getBossDataByWeek(week) { return bossData.find(b => b.week === week) || null; }

export { bossData, getBossDataByWeek };
