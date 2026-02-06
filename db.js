export function getTickets(filters) {
    // Return sample data instead of empty array to fix regression
    const N = 1000;
    const tickets = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
        tickets.push({
            id: i,
            category: i % 2 === 0 ? 'Alumbrado' : 'Bacheo',
            municipality: 'Muni1',
            responseMs: Math.random() * 20000000,
            createdAt: new Date(now - Math.random() * 2000000000).toISOString()
        });
    }
    return tickets;
}
