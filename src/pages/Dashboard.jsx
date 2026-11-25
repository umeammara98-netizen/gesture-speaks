import { useEffect, useMemo, useRef, useState } from 'react';
import { lookupLine, signCategories, signs } from '../data/lookup';
const CAPTURE_MS = 2500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
}

function signKey(sign) {
  return `${sign.category}-${sign.english}`;
}

function SignPicture({ sign, playing, onPlay }) {
  const key = signKey(sign);
  if (playing === key && sign.video) {
    return (
      <video
        className="sign-still"
        src={sign.video}
        poster={sign.image || undefined}
        autoPlay
        controls
        playsInline
        referrerPolicy="no-referrer"
        aria-label={`${sign.english} sign`}
      />
    );
  }
  if (sign.image) {
    return (
      <button
        type="button"
        className="sign-still"
        onClick={() => sign.video && onPlay(key)}
        aria-label={sign.video ? `Play the ${sign.english} sign` : `${sign.english} sign`}
      >
        <img src={sign.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      </button>
    );
  }
  if (sign.video) {
    return (
      <video
        className="sign-still"
        src={sign.video}
        preload="metadata"
        muted
        playsInline
        referrerPolicy="no-referrer"
        aria-label={`Play the ${sign.english} sign`}
        onClick={() => onPlay(key)}
      />
    );
  }
  return <div className="sign-still sign-still-empty">No picture</div>;
}

async function captureFrames(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  const frames = [];
  const started = performance.now();
  while (performance.now() - started < CAPTURE_MS) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) frames.push(blob);
    await wait(100);
  }
  return frames;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('camera');
  const [outputLang, setOutputLang] = useState('Urdu');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [noteIsError, setNoteIsError] = useState(false);
  const [query, setQuery] = useState('');
  const [resultSigns, setResultSigns] = useState([]);
  const [playing, setPlaying] = useState('');
  const videoRef = useRef(null);
  const visibleSigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return signs;
    return signs.filter((sign) => (
      sign.english.toLowerCase().includes(q) || sign.urdu.includes(query.trim()) || sign.category.toLowerCase().includes(q)
    ));
  }, [query]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.srcObject?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleCamera = async () => {
    if (!cameraActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraActive(true);
        setNote('');
      } catch {
        setNoteIsError(true);
        setNote('The browser blocked the camera, or this device has none.');
      }
      return;
    }

    videoRef.current?.srcObject?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const handleTranslate = async () => {
    if (activeTab === 'text') {
      if (!inputText.trim()) {
        setNoteIsError(true);
        setNote('Type a line first.');
        setResult('');
        setResultSigns([]);
        return;
      }
      const matches = lookupLine(inputText);
      if (!matches.length) {
        setNoteIsError(true);
        setNote('None of those words are in the common sign list.');
        setResult('');
        setResultSigns([]);
        return;
      }
      const lines = matches.map((sign) => (
        outputLang === 'Urdu' ? `${sign.urdu} (${sign.english})` : `${sign.english} — ${sign.urdu}`
      ));
      const trained = matches.filter((sign) => sign.camera).map((sign) => sign.english);
      setNoteIsError(false);
      setResult(lines.join('\n'));
      setResultSigns(matches);
      setNote(trained.length
        ? `The camera model was trained on ${trained.join(', ')}. Naming them from video still needs the model file.`
        : 'These are the English and Urdu names. The camera was not trained on these signs.');
      return;
    }

    const video = videoRef.current;
    if (!cameraActive || !video?.videoWidth) {
      setNoteIsError(true);
      setNote('Start the camera, hold a sign, then press Translate.');
      return;
    }

    setBusy(true);
    setNoteIsError(false);
    setNote('Hold the sign still.');
    setResult('');
    setResultSigns([]);
    try {
      const frames = await captureFrames(video);
      const body = new FormData();
      frames.forEach((blob, index) => body.append('frames', blob, `frame-${index}.jpg`));
      const response = await fetch('/api/recognize', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNoteIsError(true);
        const detail = errorText(data, 'Recognition failed.');
        setNote(detail.includes('word_transformer.pt') || detail.includes('camera model file')
          ? 'The camera model file is missing, so this sign cannot be named yet. The list below still has the common signs and their Urdu.'
          : detail);
        return;
      }
      const label = outputLang === 'Urdu' ? `${data.urdu} (${data.word})` : data.word;
      const percent = Math.round((data.confidence || 0) * 100);
      setResult(`${label} · ${percent}%`);
      setResultSigns(signs.filter((sign) => sign.english.toLowerCase() === String(data.word || '').toLowerCase()));
      const others = (data.top3 || []).slice(1).map((item) => (
        outputLang === 'Urdu' ? `${item.urdu} (${item.word})` : item.word
      ));
      setNoteIsError(false);
      setNote(others.length ? `Also considered: ${others.join(', ')}` : '');
    } catch {
      setNoteIsError(true);
      setNote('The recognition server is not running.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectTab = (id) => {
    setActiveTab(id);
    setNote('');
    setNoteIsError(false);
  };

  const onTabKey = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const order = ['camera', 'text'];
    const index = order.indexOf(activeTab);
    const next = order[(index + (event.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length];
    selectTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Studio</h1>
            <p>One sign at a time.</p>
          </div>
          <label className="field-label">
            Output
            <select className="select" value={outputLang} onChange={(e) => setOutputLang(e.target.value)} style={{ marginTop: 6 }}>
              <option>Urdu</option>
              <option>English</option>
            </select>
          </label>
        </div>

        <div className="tabs" role="tablist" aria-label="Studio mode" onKeyDown={onTabKey}>
          <button id="tab-camera" className="tab" type="button" role="tab" aria-selected={activeTab === 'camera'} aria-controls="panel-camera" tabIndex={activeTab === 'camera' ? 0 : -1} onClick={() => selectTab('camera')}>Sign to text</button>
          <button id="tab-text" className="tab" type="button" role="tab" aria-selected={activeTab === 'text'} aria-controls="panel-text" tabIndex={activeTab === 'text' ? 0 : -1} onClick={() => selectTab('text')}>Typed line</button>
        </div>

        <div className="studio-frame">
          <div className="stage" hidden={activeTab !== 'camera'} id="panel-camera" role="tabpanel" aria-labelledby="tab-camera">
            <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
            {!cameraActive && (
              <div className="stage-off">
                <p>Camera off. Start it, then hold one sign in frame.</p>
              </div>
            )}
          </div>
          {activeTab === 'text' && (
            <div id="panel-text" role="tabpanel" aria-labelledby="tab-text">
              <p className="hint" style={{ padding: '16px 16px 0' }}>Type English or Urdu from the list. The sign shows beside the words.</p>
              <textarea
                className="field area"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                aria-label="Line to keep"
                placeholder="English or Urdu"
                style={{ border: 0, borderRadius: 0, background: 'transparent' }}
              />
            </div>
          )}

          <div className="row-actions">
            {activeTab === 'camera' ? (
              <button
                type="button"
                className={cameraActive ? 'btn btn-danger' : 'btn'}
                onClick={toggleCamera}
              >
                {cameraActive ? 'Stop the camera' : 'Start the camera'}
              </button>
            ) : (
              <span className="count">{inputText.length} characters</span>
            )}
            <button type="button" className="btn" onClick={handleTranslate} disabled={busy} aria-busy={busy}>
              {busy ? 'Reading the sign' : 'Translate'}
            </button>
          </div>

          <div className="result-block" aria-live="polite" aria-atomic="true">
            <div className="result-head" style={{ padding: 0, border: 0 }}>
              <span className="field-label">Result</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-quiet" onClick={() => { setResult(''); setNote(''); setResultSigns([]); setPlaying(''); }}>Clear</button>
                <button type="button" className="btn btn-quiet" onClick={handleCopy} disabled={!result}>
                  {copied ? 'Copied' : 'Copy the result'}
                </button>
              </span>
            </div>
            {result ? <p style={{ whiteSpace: 'pre-line' }}>{result}</p> : <p className="result-empty">Nothing yet.</p>}
            {resultSigns.length > 0 && (
              <div className="result-signs">
                {resultSigns.map((sign) => (
                  <SignPicture key={signKey(sign)} sign={sign} playing={playing} onPlay={setPlaying} />
                ))}
              </div>
            )}
            {note && <p className={noteIsError ? 'note-bad' : 'hint'} role={noteIsError ? 'alert' : 'status'}>{note}</p>}
          </div>
        </div>

        <section className="sign-list" aria-labelledby="sign-list-title">
          <div className="page-head">
            <div>
              <h2 id="sign-list-title">Common signs</h2>
              <p>English and Urdu names for everyday Pakistani Sign Language, with the dictionary picture beside each word. Press a picture to play the sign. A Camera mark means the video model was trained on that word.</p>
            </div>
            <label className="field-label">
              Find a sign
              <input className="field" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginTop: 6 }} placeholder="Water, پانی, food" />
            </label>
          </div>
          {signCategories(visibleSigns).map((category) => (
            <div key={category} className="sign-group">
              <h3>{category}</h3>
              <div className="sign-grid">
                {visibleSigns.filter((sign) => sign.category === category).map((sign) => (
                  <article key={signKey(sign)} className="sign-card">
                    <SignPicture sign={sign} playing={playing} onPlay={setPlaying} />
                    <div className="sign-words">
                      <strong>{outputLang === 'Urdu' ? sign.urdu : sign.english}</strong>
                      <span>{outputLang === 'Urdu' ? sign.english : sign.urdu}</span>
                      {sign.camera && <em>Camera</em>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
          {visibleSigns.length === 0 && <p className="hint">No sign matches that search.</p>}
        </section>
      </div>
    </div>
  );
}
