import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey, vertexai: true }) : null;

interface Specimen {
  id: string;
  image: string;
  taxonomy: { kingdom: string; phylum: string; class: string; order: string; family: string; genus: string; species: string; };
  name: string;
  ecologicalReason: string;
  details: { sleep: string; habit: string; feature: string; size: string; weight: string; lifespan: string; };
  location: { lat: number | null; lng: number | null };
  timestamp: number;
}

const TAXONOMY_MAP: Record<string, string> = {
  kingdom: "계", phylum: "문", class: "강", order: "목", family: "과", genus: "속", species: "종"
};

const DETAIL_MAP: Record<string, string> = {
  sleep: "수면 패턴", habit: "습성", feature: "특징", size: "평균 크기", weight: "평균 무게", lifespan: "수명"
};

const LOADING_CONCEPTS = [
  { name: '하늘', chars: ['🦅', '🐦', '🦋', '🦉', '🕊️'], text: '하늘을 탐색하는 중...', bg: 'bg-sky-100/60 border-sky-200/50', deco: '☁️', min: 5, max: 7 },
  { name: '풀숲', chars: ['🌿', '🐿️', '🦌', '🐞', '🐝'], text: '풀숲을 샅샅이 뒤지는 중...', bg: 'bg-emerald-100/60 border-emerald-200/50', deco: '🌿', min: 5, max: 7 },
  { name: '강', chars: ['🐟', '🦦', '🐢', '🦀', '🦐'], text: '물에 발 담그고 관찰 중...', bg: 'bg-blue-200/60 border-blue-300/50', deco: '🪨', min: 4, max: 7 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<Specimen | null>(null);
  const [encyclopedia, setEncyclopedia] = useState<Specimen[]>([]);
  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);
  const [pinningSpecimen, setPinningSpecimen] = useState<Specimen | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<Specimen | null>(null);
  const [conceptIdx, setConceptIdx] = useState(0);
  const [decoItems, setDecoItems] = useState<any[]>([]);
  const intervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) {
      intervalRef.current = setInterval(() => {
        setConceptIdx((prev) => (prev + 1) % LOADING_CONCEPTS.length);
      }, 1500) as unknown as number;
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loading]);

  useEffect(() => {
    const concept = LOADING_CONCEPTS[conceptIdx];
    const count = Math.floor(Math.random() * (concept.max - concept.min + 1)) + concept.min;
    const items = Array.from({ length: count }).map(() => ({
      top: Math.random() * 60 + 20,
      left: Math.random() * 80 + 10,
      size: Math.random() * 4 + 3
    }));
    setDecoItems(items);
  }, [conceptIdx, loading]);

  const handleMapPin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinningSpecimen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lat = ((e.clientY - rect.top) / rect.height) * 100;
    const lng = ((e.clientX - rect.left) / rect.width) * 100;
    
    setEncyclopedia(prev => prev.map(s => s.id === pinningSpecimen.id ? { ...s, location: { lat, lng } } : s));
    setPinningSpecimen(null);
    setActiveTab('map');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ai) {
      if(fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            role: 'user',
            parts: [
              { inlineData: { mimeType: file.type, data: base64.split(',')[1] } },
              { text: `당신은 생물학자입니다. 이 생물을 분석하세요.
              1. 계-문-강-목-과-속-종 7단계 분류 체계를 한국어로 작성하세요.
              2. 이 생물이 왜 광려천의 이 환경에 서식하는지 생물학적/생태학적 근거를 들어 4문장 이상 논리적으로 분석하세요.
              3. 수면 패턴, 습성, 특징, 평균 크기, 평균 무게, 수명을 상세히 기술하세요.
              반드시 다음 JSON 형식으로만 응답하세요:
              {
                "taxonomy": {"kingdom": "", "phylum": "", "class": "", "order": "", "family": "", "genus": "", "species": ""},
                "name": "이름",
                "ecologicalReason": "논리적 서식 이유 분석",
                "details": {"sleep": "수면패턴", "habit": "습성", "feature": "특징", "size": "평균크기", "weight": "평균무게", "lifespan": "수명"}
              }` }
            ]
          }
        });
        const text = response.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setCurrentResult({ ...parsed, image: base64, location: { lat: null, lng: null }, id: Date.now().toString(), timestamp: Date.now() });
        } else {
          console.error("Could not find JSON in response:", text);
          alert("분석 결과를 파싱할 수 없습니다. 모델이 유효한 JSON을 반환하지 않았습니다.");
        }
      } catch (err) { 
        console.error("Analysis failed:", err);
        alert("분석에 실패했습니다. 다시 시도해주세요.");
      } finally { 
        setLoading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-24">
      <header className="fixed top-0 w-full z-50 bg-white/30 backdrop-blur-2xl border-b border-white/50 p-6 text-center font-medium tracking-widest text-sm text-slate-800">GWANGRYEOCHEON</header>
      
      <main className={`pt-28 px-6 max-w-lg mx-auto ${activeTab === 'map' ? 'px-0 max-w-none pt-0' : ''}`}>
        {loading ? (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${LOADING_CONCEPTS[conceptIdx].bg} backdrop-blur-md animate-in fade-in`}>
            {decoItems.map((item, i) => (
              <div key={i} className="absolute opacity-40 animate-pulse" style={{ top: `${item.top}%`, left: `${item.left}%`, fontSize: `${item.size}rem` }}>{LOADING_CONCEPTS[conceptIdx].deco}</div>
            ))}
            <div className="w-[90%] max-w-2xl h-80 rounded-[4rem] bg-white/40 backdrop-blur-3xl border border-white/80 flex flex-col items-center justify-center shadow-2xl p-10 relative z-10 mt-20">
              <div className="flex gap-6 mb-10">
                {LOADING_CONCEPTS[conceptIdx].chars.map((char, i) => (
                  <div key={i} className="text-7xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>{char}</div>
                ))}
              </div>
              <p className="font-light text-slate-800 text-2xl animate-pulse text-center">{LOADING_CONCEPTS[conceptIdx].text}</p>
            </div>
          </div>
        ) : selectedSpecimen ? (
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2rem] space-y-6 shadow-xl animate-in slide-in-from-bottom-4">
            <button onClick={() => setSelectedSpecimen(null)} className="text-slate-500 hover:text-slate-900 transition-colors">← Back</button>
            <img src={selectedSpecimen.image} className="w-full h-72 object-cover rounded-[1.5rem]" />
            <h2 className="text-3xl font-bold text-slate-900">{selectedSpecimen.name}</h2>
            <div className="space-y-4 text-sm text-slate-700">
              <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                <p className="font-bold text-emerald-700 mb-2">분류 체계</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  {Object.entries(selectedSpecimen.taxonomy).map(([k, v]) => <p key={k}>{TAXONOMY_MAP[k]}: {v}</p>)}
                </div>
              </div>
              <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                <p className="font-bold text-emerald-700 mb-2">서식 이유 분석</p>
                <p className="leading-relaxed">{selectedSpecimen.ecologicalReason}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selectedSpecimen.details).map(([k, v]) => <div key={k} className="bg-white/50 p-3 rounded-xl"><strong>{DETAIL_MAP[k]}:</strong> {v}</div>)}
              </div>
            </div>
          </div>
        ) : activeTab === 'map' ? (
          <div className="w-full h-screen relative">
            <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d19751.781825006783!2d128.52705891000164!3d35.26050990517693!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sko!2skr!4v1775377230977!5m2!1sko!2skr" className="w-full h-full" style={{border:0}} allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            {pinningSpecimen ? (
              <div className="absolute inset-0 z-50 bg-black/10 cursor-crosshair" onClick={handleMapPin}>
                <div className="absolute top-20 left-6 right-6 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl text-center animate-bounce">
                  {pinningSpecimen.name}의 위치를 클릭하세요!
                </div>
              </div>
            ) : (
              encyclopedia.filter(s => s.location.lat !== null).map(s => (
                <div key={s.id} className="absolute z-40 -ml-6 -mt-6" style={{ top: `${s.location.lat}%`, left: `${s.location.lng}%` }} onMouseEnter={() => setHoveredMarker(s)} onMouseLeave={() => setHoveredMarker(null)}>
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-500 shadow-lg overflow-hidden bg-white/80 backdrop-blur-sm">
                    <img src={s.image} className="w-full h-full object-cover" />
                  </div>
                  {hoveredMarker?.id === s.id && (
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-xl w-40 text-center border border-emerald-100">
                      <p className="font-bold text-sm">{s.name}</p>
                      <button onClick={() => setSelectedSpecimen(s)} className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg">세부 정보</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'encyclopedia' ? (
          <div className="grid grid-cols-2 gap-4">
            {encyclopedia.map(s => (
              <div key={s.id} className="bg-white/40 backdrop-blur-xl border border-white/60 p-3 rounded-[1.5rem] shadow-sm">
                <div className="aspect-square w-full overflow-hidden rounded-[1rem]">
                  <img src={s.image} className="w-full h-full object-cover" />
                </div>
                <p className="font-medium mt-3 text-sm">{s.name}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setSelectedSpecimen(s)} className="flex-1 bg-white/50 py-1 rounded-lg text-xs">세부 정보</button>
                  <button onClick={() => { setPinningSpecimen(s); setActiveTab('map'); }} className="flex-1 bg-blue-900 text-white py-1 rounded-lg text-xs">핀 추가</button>
                </div>
              </div>
            ))}
          </div>
        ) : currentResult ? (
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 p-8 rounded-[2rem] space-y-6 shadow-xl">
            <img src={currentResult.image} className="w-full h-72 object-cover rounded-[1.5rem]" />
            <h2 className="text-3xl font-bold">{currentResult.name}</h2>
            <div className="bg-white/50 p-4 rounded-2xl border border-white/50 font-mono text-xs">
              <p className="font-bold text-emerald-700 mb-2">분류 체계</p>
              {Object.entries(currentResult.taxonomy).map(([k, v]) => <p key={k}>{TAXONOMY_MAP[k]}: {v}</p>)}
            </div>
            <p className="text-sm text-slate-700"><strong>서식 이유:</strong> {currentResult.ecologicalReason}</p>
            <button onClick={() => { setEncyclopedia([...encyclopedia, currentResult]); setCurrentResult(null); setActiveTab('encyclopedia'); }} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold">도감 저장</button>
          </div>
        ) : (
          <label className="w-full h-64 border border-slate-300/50 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-white/50 transition-all backdrop-blur-xl bg-white/20">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            <div className="text-5xl mb-4 text-emerald-700">＋</div>
            <span className="font-light text-slate-600">생물 촬영 및 분석</span>
          </label>
        )}
      </main>

      <nav className="fixed bottom-8 left-6 right-6 bg-white/30 backdrop-blur-3xl border border-white/50 rounded-[2rem] p-3 flex justify-around shadow-2xl">
        {['home', 'encyclopedia', 'map'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setPinningSpecimen(null); }} className={`px-6 py-2 rounded-full transition-all ${activeTab === tab ? 'bg-blue-900 text-white font-bold' : 'text-slate-600'}`}>
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>
    </div>
  );
}
