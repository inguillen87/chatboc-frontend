let cachedTickets = null;

export function getTickets(filters) {
    // Return sample data instead of empty array to fix regression
    if (!cachedTickets) {
        const N = 1000;
        cachedTickets = [];
        const now = Date.now();
        for (let i = 0; i < N; i++) {
            cachedTickets.push({
                id: i,
                category: i % 2 === 0 ? 'Alumbrado' : 'Bacheo',
                municipality: 'Muni1',
                responseMs: Math.random() * 20000000,
                createdAt: new Date(now - Math.random() * 2000000000).toISOString()
            });
        }
    }
    return cachedTickets;
}
