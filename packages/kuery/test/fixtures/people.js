module.exports = [
  {
    id: 1, name: 'Andreas', address: { street: 'Bellmansgatan' },
    born: new Date('1980-01-01T12:00:00.000Z')
  },
  { id: 2, name: 'Sven', born: new Date('1989-01-01T12:00:00.000Z') },
  { id: 3, name: 'Christian', born: new Date('1990-01-01T12:00:00.000Z') },
  {
    id: 4, name: 'Emil', girlfriends: [{ name: 'fanny', hotness: 10 },
      { name: 'eve', hotness: 1000 }], born: new Date('1982-01-01T12:00:00.000Z')
  }
];
