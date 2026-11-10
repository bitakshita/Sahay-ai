const j = async r => { if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r.json() }
export const api = {
  get: u => fetch(u).then(j),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(j),
  del: u => fetch(u, { method: 'DELETE' }).then(j),
}
