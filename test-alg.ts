async function test() {
    const res = await fetch('https://api.sofascore.com/api/v1/search/all?q=algerian%20cup');
    const data = await res.json();
    console.log(data.results.filter((r: any) => r.type === 'uniqueTournament').map((r: any) => ({ name: r.entity.name, id: r.entity.id })));
}
test();
