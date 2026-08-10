import { readFileSync, writeFileSync } from 'fs';

const cities = JSON.parse(readFileSync('./target_cities.json', 'utf8'));

// Fisher-Yates shuffle
for (let i = cities.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [cities[i], cities[j]] = [cities[j], cities[i]];
}

writeFileSync('./target_cities_shuffled.json', JSON.stringify(cities, null, 2));

const us     = cities.filter(c => !c.country || c.country === 'United States');
const africa = cities.filter(c => c.country && c.country !== 'United States');
console.log(`Shuffled ${cities.length} cities (${us.length} US + ${africa.length} Africa)`);
console.log('First 10:', cities.slice(0, 10).map(c => `${c.city} (${c.country || 'US'})`).join(', '));
