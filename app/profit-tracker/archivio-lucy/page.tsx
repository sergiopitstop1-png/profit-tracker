'use client'

import { useCallback, useEffect, useState } from 'react'

type Mail = {
  id:number; data_mail:string|null; cliente_nome:string|null; bookmaker:string|null; mittente:string|null;
  oggetto:string|null; categoria:string|null; giudizio:string|null; priorita:string|null; motivazione_ai:string|null;
  bonus_importo:number|null; scadenza:string|null; feedback_utente:string|null
}

export default function ArchivioLucyPage() {
  const [rows,setRows]=useState<Mail[]>([])
  const [count,setCount]=useState(0)
  const [loading,setLoading]=useState(false)
  const [f,setF]=useState({q:'',cliente:'',bookmaker:'',giudizio:'',categoria:'',priorita:''})

  const load=useCallback(async()=>{
    setLoading(true)
    const p=new URLSearchParams()
    Object.entries(f).forEach(([k,v])=>{if(v)p.set(k,v)})
    const r=await fetch('/api/lucy-mail/archive?'+p.toString(),{cache:'no-store'})
    const j=await r.json()
    setRows(j.data||[]); setCount(j.count||0); setLoading(false)
  },[f])

  useEffect(()=>{load()},[load])

  async function feedback(id:number,value:string){
    await fetch('/api/lucy-mail/archive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,feedback_utente:value})})
    load()
  }

  const field=(key:keyof typeof f, placeholder:string)=>
    <input className="border rounded px-3 py-2 bg-white text-black" placeholder={placeholder} value={f[key]}
      onChange={e=>setF({...f,[key]:e.target.value})}/>

  return <main className="p-6 max-w-[1600px] mx-auto">
    <div className="flex items-end justify-between gap-4 mb-5">
      <div><h1 className="text-3xl font-bold">📨 Archivio Lucy</h1><p className="opacity-70">Calderone completo: {count} mail</p></div>
      <button onClick={load} className="border rounded px-4 py-2">Aggiorna</button>
    </div>
    <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-2 mb-5">
      {field('q','Cerca testo...')}{field('cliente','Cliente')}{field('bookmaker','Bookmaker')}
      <select className="border rounded px-3 py-2 bg-white text-black" value={f.giudizio} onChange={e=>setF({...f,giudizio:e.target.value})}>
        <option value="">Tutti i giudizi</option><option>UTILE</option><option>DA_VALUTARE</option><option>IGNORA</option><option>DA_ANALIZZARE</option>
      </select>
      <select className="border rounded px-3 py-2 bg-white text-black" value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value})}>
        <option value="">Tutte le categorie</option><option>PROMO</option><option>OPERATIVA</option><option>SICUREZZA</option><option>AMMINISTRATIVA</option><option>NEWSLETTER</option><option>ALTRO</option>
      </select>
      <select className="border rounded px-3 py-2 bg-white text-black" value={f.priorita} onChange={e=>setF({...f,priorita:e.target.value})}>
        <option value="">Tutte le priorità</option><option>alta</option><option>media</option><option>bassa</option>
      </select>
    </div>
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm"><thead><tr className="text-left border-b">
        <th className="p-3">Data</th><th>Cliente</th><th>Book</th><th>Oggetto</th><th>Lucy</th><th>Dettagli</th><th>Feedback</th>
      </tr></thead><tbody>
      {loading?<tr><td className="p-4" colSpan={7}>Caricamento…</td></tr>:rows.map(m=><tr key={m.id} className="border-b align-top">
        <td className="p-3 whitespace-nowrap">{m.data_mail?new Date(m.data_mail).toLocaleString('it-IT'):'-'}</td>
        <td className="p-3">{m.cliente_nome||'-'}</td><td className="p-3">{m.bookmaker||m.mittente||'-'}</td>
        <td className="p-3 min-w-[260px]">{m.oggetto||'(senza oggetto)'}</td>
        <td className="p-3"><b>{m.giudizio}</b><div>{m.categoria} · {m.priorita}</div></td>
        <td className="p-3 min-w-[280px]">{m.motivazione_ai||'In attesa di analisi'}{m.bonus_importo!=null&&<div>Bonus: € {m.bonus_importo}</div>}</td>
        <td className="p-3 whitespace-nowrap"><button onClick={()=>feedback(m.id,'UTILE')} className="mr-2">👍</button><button onClick={()=>feedback(m.id,'INUTILE')}>👎</button></td>
      </tr>)}
      {!loading&&rows.length===0&&<tr><td className="p-4" colSpan={7}>Nessuna mail trovata.</td></tr>}
      </tbody></table>
    </div>
  </main>
}
