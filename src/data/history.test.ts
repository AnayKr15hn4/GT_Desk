import { describe, expect, it } from 'vitest';

import type { Bout, SportEvent } from '@/lib/types';

import {
  ageFrom,
  CAMERA_NAME,
  carCaption,
  cardFighters,
  commonsCategory,
  gallerySources,
  gather,
  nameWords,
  isF1Shot,
  isFighterArticle,
  oneOfEach,
  otherHandSecond,
  paragraphsOf,
  parseRecord,
  photoFrom,
  ranked,
  summarizeWins,
  tally,
  townScore,
  townTitle,
  trackScore,
  varied,
  venueScore,
  wikiTitle,
  type F1History,
  type PastWin,
  type Photo,
} from './history';

const win = (season: number, driver: string, team: string, raceName = 'Qatar Grand Prix'): PastWin => ({ season, raceName, driver, team });

// Losail's real winners, newest first.
const LOSAIL = [
  win(2025, 'Max Verstappen', 'Red Bull'),
  win(2024, 'Max Verstappen', 'Red Bull'),
  win(2023, 'Max Verstappen', 'Red Bull'),
  win(2021, 'Lewis Hamilton', 'Mercedes'),
];

describe('a circuit read from its winners', () => {
  it('says how long, who has won most, and the streak', () => {
    expect(summarizeWins('Losail International Circuit', LOSAIL)).toEqual([
      'Formula 1 has raced at Losail International Circuit 4 times, first in 2021.',
      'Max Verstappen has won here three times, more than anyone else.',
      'Red Bull have won three of the 4.',
      'Max Verstappen has won the last three in a row, most recently in 2025 for Red Bull.',
    ]);
  });

  it('handles a first race and a single one', () => {
    expect(summarizeWins('Madring', [])).toEqual(["This is Formula 1's first race at Madring."]);
    expect(summarizeWins('Las Vegas Strip Circuit', [win(2023, 'Max Verstappen', 'Red Bull')])).toEqual([
      'Formula 1 has raced at Las Vegas Strip Circuit once before, in 2023, when Max Verstappen won for Red Bull.',
    ]);
  });

  it('says when no one has won twice, and names the latest winner', () => {
    const lines = summarizeWins('Circuit', [win(2024, 'A', 'X'), win(2023, 'B', 'Y'), win(2022, 'C', 'Z')]);
    expect(lines).toContain('No one has won here twice: every race has had a different winner.');
    expect(lines).toContain('A won the most recent race here, in 2024, for X.');
  });

  it('counts wins, most first, a tie going to whoever won here first', () => {
    const wins = [win(2024, 'B', 'X'), win(2023, 'A', 'X'), win(2022, 'B', 'X'), win(2021, 'A', 'X'), win(2020, 'C', 'X')];
    expect(tally(wins, (w) => w.driver)).toEqual([
      { name: 'A', wins: 2 },
      { name: 'B', wins: 2 },
      { name: 'C', wins: 1 },
    ]);
  });
});

describe('Wikipedia text', () => {
  it('drops the foreign-language gloss and pronunciation from an intro', () => {
    expect(paragraphsOf('The Qatar Grand Prix (Arabic: جائزة قطر الكبرى) is a race.\n\nIt began in 2021.')).toEqual(['The Qatar Grand Prix is a race.', 'It began in 2021.']);
  });

  it('keeps a birth date that shares the gloss', () => {
    const [first] = paragraphsOf('Sharabutdin Magomedov (Russian: Шарабутдин Магомедов; born 16 May 1994) is a fighter.');
    expect(first).toBe('Sharabutdin Magomedov (born 16 May 1994) is a fighter.');
    expect(ageFrom(first, new Date('2026-11-24T12:00:00Z'))).toBe(32);
  });

  it('turns an article link into its title', () => {
    expect(wikiTitle('http://en.wikipedia.org/wiki/Losail_International_Circuit')).toBe('Losail International Circuit');
    expect(wikiTitle('https://en.wikipedia.org/wiki/Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez')).toBe('Autódromo Hermanos Rodríguez');
    expect(wikiTitle('https://en.wikipedia.org/wiki/Las_Vegas_Grand_Prix#Circuit')).toBe('Las Vegas Grand Prix');
    expect(wikiTitle(undefined)).toBeNull();
  });

  it("works out an age from the article's birth date, either way round", () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(ageFrom('Israel Mobolaji Adesanya (born 22 July 1989) is a fighter.', now)).toBe(37);
    expect(ageFrom('Someone (born December 1, 1990) is a fighter.', now)).toBe(35);
    expect(ageFrom('Someone (born November 25, 1990) is a fighter.', now)).toBe(35);
    expect(ageFrom('No birth date here.', now)).toBeUndefined();
  });

  it('tells a fighter from a namesake', () => {
    const article = (text: string) => ({ title: 'X', paragraphs: [text], url: '' });
    expect(isFighterArticle(article('a Brazilian professional mixed martial artist'))).toBe(true);
    expect(isFighterArticle(article('an American politician'))).toBe(false);
    expect(isFighterArticle(null)).toBe(false);
  });

  it('reads a fight record', () => {
    expect(parseRecord('24-5-0')).toEqual({ wins: 24, losses: 5, draws: 0 });
    expect(parseRecord('15-2')).toEqual({ wins: 15, losses: 2, draws: 0 });
    expect(parseRecord('30-10-1, 1 NC')).toEqual({ wins: 30, losses: 10, draws: 1 });
    expect(parseRecord(undefined)).toBeNull();
  });
});

describe('photos', () => {
  const file = (over: { title?: string; width?: number; height?: number; mime?: string; license?: string; categories?: string; description?: string } = {}) => ({
    title: over.title ?? 'File:2024 British Grand Prix, Norris (1).jpg',
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/a/b/full.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
        thumburl: 'https://upload.wikimedia.org/thumb/a/b/full.jpg/960px-full.jpg',
        thumbwidth: 960,
        thumbheight: 640,
        width: over.width ?? 3000,
        height: over.height ?? 2000,
        mime: over.mime ?? 'image/jpeg',
        extmetadata: {
          LicenseShortName: { value: over.license ?? 'CC BY-SA 2.0' },
          Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jen">Jen</a>' },
          ImageDescription: { value: over.description ?? 'Norris at <b>Silverstone</b>' },
          Categories: { value: over.categories ?? '2024 British Grand Prix|McLaren MCL38 of Lando Norris' },
        },
      },
    ],
  });

  it('keeps a freely licensed photograph, credited, with a larger copy for the viewer', () => {
    expect(photoFrom(file())).toMatchObject({
      src: 'https://upload.wikimedia.org/thumb/a/b/full.jpg/960px-full.jpg',
      large: 'https://upload.wikimedia.org/thumb/a/b/full.jpg/1920px-full.jpg',
      caption: 'Norris at Silverstone',
      title: '2024 British Grand Prix, Norris (1).jpg',
      categories: ['2024 British Grand Prix', 'McLaren MCL38 of Lando Norris'],
      author: 'Jen',
      license: 'CC BY-SA 2.0',
    });
    // A video still's notes on where it came from are left out of its caption.
    const still = file({ description: 'Magomedov at the weigh-in for UFC on ABC 6, taken from the Sexto Round YouTube channel. (Cropped at 8:48).' });
    expect(photoFrom(still)?.caption).toBe('Magomedov at the weigh-in for UFC on ABC 6');
    expect(photoFrom(file())?.largeWidth).toBe(1920);
    // Not much bigger than the viewer: the original itself.
    expect(photoFrom(file({ width: 1600, height: 1000 }))).toMatchObject({ large: 'https://upload.wikimedia.org/a/b/full.jpg', largeWidth: 1600 });
  });

  it('leaves out logos, maps, flags, satellite views, small or odd shapes, and anything not free', () => {
    expect(photoFrom(file({ title: 'File:Losail circuit map.jpg' }))).toBeNull();
    expect(photoFrom(file({ title: 'File:UFC logo.jpg' }))).toBeNull();
    // A track drawn and saved as a JPEG, a fan's flag, a satellite view: known by what they're filed under.
    expect(photoFrom(file({ categories: 'Self-published work|Yas Marina Circuit circuit maps' }))).toBeNull();
    expect(photoFrom(file({ categories: '2021 Abu Dhabi Grand Prix|Photographs of flags of Mexico' }))).toBeNull();
    expect(photoFrom(file({ categories: 'Yas Marina Circuit|Images by SkySat satellites' }))).toBeNull();
    expect(photoFrom(file({ mime: 'image/svg+xml' }))).toBeNull();
    expect(photoFrom(file({ width: 500, height: 400 }))).toBeNull();
    expect(photoFrom(file({ width: 4000, height: 1000 }))).toBeNull();
    expect(photoFrom(file({ license: 'Fair use' }))).toBeNull();
  });

  it('leaves out PNGs, nearly all of them diagrams, maps and renders', () => {
    expect(photoFrom(file({ mime: 'image/png' }))).toBeNull();
  });

  it('keeps only photos of the cars, by what Commons files them under', () => {
    for (const car of [
      'McLaren MCL38 of Lando Norris',
      'Lotus E20 of Kimi Räikkönen',
      'Ferrari 150° Italia of Fernando Alonso',
      'Toro Rosso STR5 of Sébastien Buemi',
      'Mercedes-AMG F1 W15 E Performance of George Russell',
      'Force India VJM05 of Paul di Resta',
    ])
      expect(isF1Shot(['2024 British Grand Prix', car])).toBe(true);
    // A driver off track (a charity football match), parades, fly-pasts, a city's sights.
    expect(isF1Shot(['2011 Abu Dhabi Grand Prix', 'Felipe Massa in 2011'])).toBe(false);
    expect(isF1Shot(['Formula One drivers parades', '2024 British Grand Prix'])).toBe(false);
    expect(isF1Shot(['2024 British Grand Prix', 'Smoke trails of aircraft'])).toBe(false);
    expect(isF1Shot(['2010 Abu Dhabi Grand Prix', 'Hotels of Abu Dhabi'])).toBe(false);
    expect(isF1Shot(['2019 Abu Dhabi Grand Prix', 'Boeing 787-9 of Etihad Airways', 'Boeing 787-9 in 2019'])).toBe(false);
  });

  it('captions a race photo with what it shows, not what the uploader wrote', () => {
    const shot = (categories: string[], caption = 'Paf customers travel to Dubai to experience the city') => ({ caption, categories }) as unknown as Photo;
    expect(carCaption(shot(['2012 Abu Dhabi Grand Prix', 'Lotus E20 of Kimi Räikkönen']), 2012, 'Abu Dhabi Grand Prix')).toBe(
      'Kimi Räikkönen in the Lotus E20 at the 2012 Abu Dhabi Grand Prix',
    );
    expect(carCaption(shot(['Ferrari F10 of Fernando Alonso', 'Red Bull RB6 of Mark Webber']), 2010, 'Abu Dhabi Grand Prix')).toBe(
      'Fernando Alonso and Mark Webber at the 2010 Abu Dhabi Grand Prix',
    );
    const start = ['Lotus E23 Hybrid of Romain Grosjean', 'Williams FW37 of Felipe Massa', 'Toro Rosso STR10 of Max Verstappen'];
    expect(carCaption(shot(start, 'The start of the race'), 2015, 'Abu Dhabi Grand Prix')).toBe('The start of the race');
    expect(carCaption(shot(start, 'IMG_2231'), 2015, 'Abu Dhabi Grand Prix')).toBe('At the 2015 Abu Dhabi Grand Prix');
  });

  it('keeps the original of a retouched or cropped copy, and a batch of different shots', () => {
    const photo = (page: string, title: string, categories: string[] = [], caption = 'Kobayashi on Sunday') => ({ page, title, categories, caption, author: 'Yuriy' }) as unknown as Photo;
    const copy = photo('b', 'Kobayashi 2009 Abu Dhabi Grand Prix2.jpg', ['Retouched pictures']);
    const original = photo('a', 'Kobayashi 2009 Abu Dhabi Grand Prix.jpg', ['Files with derivative versions']);
    expect(oneOfEach([copy, original]).map((p) => p.page)).toEqual(['a']);
    expect(oneOfEach([original, copy]).map((p) => p.page)).toEqual(['a']);
    const batch = [photo('1', 'Silverstone (1).jpg', [], 'British Grand Prix 2026'), photo('2', 'Silverstone (2).jpg', [], 'British Grand Prix 2026')];
    expect(oneOfEach(batch)).toHaveLength(2);
  });

  it('takes one of each year before any year twice', () => {
    const photo = (year: number, i: number) => ({ page: `${year}-${i}`, categories: [`${year} British Grand Prix`] }) as unknown as Photo;
    const photos = [...[1, 2, 3].map((i) => photo(2024, i)), photo(2023, 1), photo(2023, 2)];
    expect(varied(photos, (p) => p.categories[0], 2).map((p) => p.page)).toEqual(['2024-1', '2023-1']);
    expect(varied(photos, (p) => p.categories[0], 4).map((p) => p.page)).toEqual(['2024-1', '2023-1', '2024-2', '2024-3']);
  });

  const pic = (title: string, categories: string[] = [], over: Partial<Photo> = {}) =>
    ({ page: title, title, categories, caption: title, author: 'Jen', largeWidth: 1920, ...over }) as unknown as Photo;

  it('knows a photo of the circuit itself from one of a car, a person or a food stall', () => {
    expect(trackScore(pic('BRDC Grandstand Silverstone Circuit 2026.jpg', ['Silverstone Circuit']), false)).toBeGreaterThan(0);
    expect(trackScore(pic('YasMarina1.jpeg', ['Yas Marina Circuit', 'Hairpin turns in racing circuits']), true)).toBeGreaterThan(0);
    expect(trackScore(pic('Mansell and Senna at Silverstone.jpg', ['Williams FW14 of Nigel Mansell']), true)).toBeNull();
    expect(trackScore(pic('Cal Crutchlow 2010 SBK Silverstone 2.jpg', ['Cal Crutchlow in 2010']), true)).toBeNull();
    expect(trackScore(pic('Silverstone 2010 - Race formation lap Superleague Formula.JPG', ['Formation laps in automobile racing']), true)).toBeNull();
    expect(trackScore(pic('Fast food outlets at Becketts Corner, Silverstone.jpg', ['Silverstone Circuit']), false)).toBeNull();
    expect(trackScore(pic('Alexander Rossi - American Race Car Driver.jpg', ['Yas Marina Circuit']), false)).toBeNull();
    // Filed under the circuit, but nothing says it shows the track.
    expect(trackScore(pic('Bikers-brotherhood.jpg', ['Yas Marina Circuit']), false)).toBeNull();
    // Commons' own picks and aerial views come first, then the parts of a track.
    const grandstand = trackScore(pic('North Grandstand.jpg'), false) ?? 0;
    expect(trackScore(pic('Yas Marina Circuit + Ferrari World.jpg', ['Aerial photographs of the United Arab Emirates']), false)).toBeGreaterThan(grandstand);
    expect(trackScore(pic('Eau Rouge corner.jpg', ['Quality images']), false)).toBeGreaterThan(grandstand);
    // Chosen by the circuit's article, but of the stream a corner is named after.
    expect(trackScore(pic('Eau Rouge01.jpg', ['Eau Rouge', 'Iron-rich water']), true)).toBeNull();
    // Named in the language of the place: the Raidillon, an aerial photo in German.
    expect(trackScore(pic('Francorchamps01.jpg', ["Raidillon de l'Eau Rouge"]), true)).toBeGreaterThan(0);
    expect(trackScore(pic('Luftaufnahme des Red Bull Ring 2022.jpg'), false)).toBeGreaterThan(grandstand);
    // A street circuit's own article: a photo that names the place counts, one only filed there doesn't.
    const sphere = pic('2024 Las Vegas Grand Prix at the Sphere.jpg', ['Las Vegas Grand Prix']);
    expect(nameWords('Las Vegas Strip Circuit')).toEqual(['las', 'vegas', 'strip']);
    expect(trackScore(sphere, true, nameWords('Las Vegas Strip Circuit'))).toBeGreaterThan(0);
    expect(trackScore(sphere, false, nameWords('Las Vegas Strip Circuit'))).toBeNull();
    // A visit's photo, however it's filed.
    const visit = pic('Las Vegas Grand Prix (54942398305).jpg', ['Las Vegas Grand Prix'], { caption: 'Secretary of Homeland Security and FBI Director visit the Las Vegas Grand Prix' });
    expect(trackScore(visit, true, nameWords('Las Vegas Strip Circuit'))).toBeNull();
  });

  it('knows a photo of the town from one of the racing', () => {
    expect(townScore(pic('Spielberg, Austria - panoramio.jpg'), 'Spielberg', false)).toBeGreaterThan(0);
    expect(townScore(pic('Spa Casino R01.jpg', ['Spa (Belgium)']), 'Spa', false)).toBeGreaterThan(0);
    expect(townScore(pic('Vip-tower-f1-bahrain.jpg', ['Bahrain International Circuit']), 'Sakhir', true)).toBeNull();
    expect(townScore(pic('Bucknell Wood - geograph.org.uk - 443631.jpg', ['Silverstone']), 'Silverstone', false)).toBeNull();
    expect(townScore(pic('A view of Silverstone.jpg', ['Taxis in Silverstone', 'Cars in England']), 'Silverstone', false)).toBeNull();
    expect(townScore(pic('Interior of Hotel Hermitage Monte Carlo.jpg'), 'Monte Carlo', true)).toBeNull();
  });

  it('knows a photo of the arena from one of a show on its floor', () => {
    const kia = nameWords('Kia Center');
    expect(venueScore(pic('Kia Center 12-22-24.jpg'), true, kia, 'Kia Center')).toBeGreaterThan(0);
    // Under its old name, filed under the arena, a part of the building still says what it shows;
    // a place photographed in a year isn't a person's year.
    const amway = pic('Amway CENTER.jpg', ['Kia Center', 'Sports venues in the United States photographed in 2010']);
    expect(venueScore(amway, false, kia, 'Kia Center')).toBeGreaterThan(0);
    // Concerts, games and the people at them are shows, not the building.
    expect(venueScore(pic('Santana Acer Arena Sydney (5560384512).jpg', ['2011 concerts', 'Qudos Bank Arena']), false, nameWords('Qudos Bank Arena'), 'Qudos Bank Arena')).toBeNull();
    expect(venueScore(pic('LeBron jump shot 2004.jpg', ['Basketball players']), false, kia, 'Kia Center')).toBeNull();
    // Filed under the arena, but nothing says it shows the building.
    expect(venueScore(pic('952A3147 (51692988060).jpg', ['T-Mobile Arena']), false, nameWords('T-Mobile Arena'), 'T-Mobile Arena')).toBeNull();
    // A category about the building as a venue isn't a game on its floor.
    expect(venueScore(pic('Qudos Bank Arena.jpg', ['Qudos Bank Arena', 'Sydney 2000 Olympic Games venues']), false, ['afterpay', 'arena'], 'Qudos Bank Arena')).toBeGreaterThan(0);
    // The stadium next door, in the arena's article: neither filed under the arena nor named for it.
    expect(venueScore(pic('ANZ Stadium Sydney July 2015 (cropped).jpg', ['Stadium Australia']), true, ['afterpay', 'arena', 'superdome'], 'Qudos Bank Arena')).toBeNull();
  });

  it('ranks the best first, then the best by someone else', () => {
    const photos = [pic('a.jpg', [], { author: 'Ann' }), pic('b.jpg', [], { author: 'Ann' }), pic('c.jpg', [], { author: 'Bo' }), pic('d.jpg')];
    const score = (p: Photo) => ({ 'a.jpg': 9, 'b.jpg': 8, 'c.jpg': 1, 'd.jpg': null })[p.title] ?? null;
    expect(ranked(photos, score).map((p) => p.title)).toEqual(['a.jpg', 'c.jpg', 'b.jpg']);
    expect(otherHandSecond([pic('x.jpg', [], { author: 'Ann' }), pic('y.jpg', [], { author: 'Ann' })]).map((p) => p.title)).toEqual(['x.jpg', 'y.jpg']);
  });

  it('gathers each set in order, without a photo twice', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((t) => pic(t));
    const sets = [
      { group: 'On track', photos: [a, b, c], count: 2 },
      { group: 'Yas Marina Circuit', photos: [b, c, d], count: 2 },
      { group: 'Abu Dhabi', photos: [], count: 2 },
    ];
    expect(gather(sets).map((p) => [p.title, p.group])).toEqual([
      ['a', 'On track'],
      ['b', 'On track'],
      ['c', 'Yas Marina Circuit'],
      ['d', 'Yas Marina Circuit'],
    ]);
  });

  it("finds a circuit's or town's Commons category, and a town's own article", () => {
    expect(commonsCategory('Suzuka Circuit', [{ title: 'Category:Honda' }, { title: 'Category:Suzuka_Circuit' }])).toBe('Suzuka Circuit');
    expect(commonsCategory('Albert Park Circuit', [{ title: 'Category:Melbourne_Grand_Prix_Circuit' }])).toBe('Melbourne Grand Prix Circuit');
    expect(commonsCategory('Silverstone Circuit', [{ title: 'Silverstone_Circuit' }])).toBe('Silverstone Circuit');
    expect(commonsCategory('Madring', [])).toBe('Madring');
    expect(townTitle('Spa', ['Circuit de Spa-Francorchamps', 'Spa, Belgium', '2021 6 Hours of Spa-Francorchamps'])).toBe('Spa, Belgium');
    expect(townTitle('Marina Bay', ['Marina Bay Sands', 'Marina Bay, Singapore', 'Marina Bay Street Circuit'])).toBe('Marina Bay, Singapore');
    expect(townTitle('Austin', ['University of Texas at Austin'])).toBeNull();
  });

  it('spots a caption that is only a camera file name', () => {
    for (const name of ['IMG_6389', 'DSC_0043', 'P1010012', '20240707_143512']) expect(CAMERA_NAME.test(name)).toBe(true);
    for (const name of ['McLaren', 'WTCC 2016, Qatar', 'Lando Norris at Silverstone']) expect(CAMERA_NAME.test(name)).toBe(false);
  });
});

describe('an event page background', () => {
  const fighter = (name: string) => ({ name, record: '10-1-0' });
  const bout = (id: string, a: string, b: string, segment: Bout['segment'], isMainEvent = false): Bout => ({ id, fighters: [fighter(a), fighter(b)], segment, isMainEvent });
  const ufc = {
    id: 'ufc-1',
    sport: 'ufc',
    name: 'UFC Fight Night',
    venue: { name: 'ANB Arena' },
    bouts: [
      bout('1', 'Early One', 'Early Two', 'prelims'),
      bout('2', 'Co One', 'Co Two', 'main_card'),
      bout('3', 'Israel Adesanya', 'TBA', 'main_card', true),
    ],
  } as unknown as SportEvent;

  it("puts the main event's fighters first, the main card next, and no placeholders", () => {
    expect(cardFighters(ufc).map((f) => [f.fighter.name, f.mainEvent])).toEqual([
      ['Israel Adesanya', true],
      ['Co One', false],
      ['Co Two', false],
    ]);
  });

  it("looks for a fight night's photos of its arena (under every name it has had) and its city", () => {
    const apex = { ...ufc, venue: { name: 'Meta APEX', city: 'Las Vegas', lat: 36.17, lon: -115.14 } } as unknown as SportEvent;
    expect(gallerySources(apex, null)).toEqual({
      sport: 'ufc',
      venue: { name: 'Meta APEX', aliases: ['UFC Apex'], city: 'Las Vegas', lat: 36.17, lon: -115.14 },
      place: { name: 'Las Vegas', lat: 36.17, lon: -115.14 },
    });
    expect(gallerySources(ufc, null)).toMatchObject({ sport: 'ufc', venue: { name: 'ANB Arena', aliases: [] } });
  });

  it("looks for a Grand Prix's photos under the years it ran by that name, its circuit and its town", () => {
    const race = { id: 'f1-1', sport: 'f1', name: 'Qatar Grand Prix', venue: { name: 'Lusail International Circuit', city: 'Lusail', lat: 25.49, lon: 51.45 } } as unknown as SportEvent;
    const history: F1History = {
      circuit: { id: 'losail', name: 'Losail International Circuit', url: 'http://en.wikipedia.org/wiki/Lusail_International_Circuit' },
      wins: [...LOSAIL.slice(0, 2), win(2023, 'Max Verstappen', 'Red Bull', 'Lusail Sprint Grand Prix')],
      article: { title: 'Qatar Grand Prix', paragraphs: ['x'], url: '' },
    };
    expect(gallerySources(race, history)).toEqual({
      sport: 'f1',
      raceName: 'Qatar Grand Prix',
      seasons: [2025, 2024],
      circuit: { name: 'Losail International Circuit', articles: ['Lusail International Circuit'] },
      place: { name: 'Lusail', lat: 25.49, lon: 51.45 },
    });
    // Without the history, the schedule's own name for the venue.
    expect(gallerySources(race, undefined)).toMatchObject({ seasons: [], circuit: { name: 'Lusail International Circuit', articles: ['Lusail International Circuit'] } });
    // Linked to the race's article, the circuit's own name comes next.
    const vegas = { ...race, name: 'Las Vegas Grand Prix', venue: { name: 'Las Vegas Strip Street Circuit', city: 'Las Vegas' } } as unknown as SportEvent;
    const linked = { ...history, circuit: { id: 'vegas', name: 'Las Vegas Strip Street Circuit', url: 'https://en.wikipedia.org/wiki/Las_Vegas_Grand_Prix#Circuit' } };
    expect(gallerySources(vegas, linked)).toMatchObject({ circuit: { articles: ['Las Vegas Grand Prix', 'Las Vegas Strip Street Circuit'] } });
  });
});
