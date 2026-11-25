import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const studio = user ? '/dashboard' : '/signup';

  return (
    <>
      <section className="screen">
        <div className="wrap hero-grid">
          <div data-enter>
            <h1>Sign language studio for Urdu and English</h1>
            <p className="fact">The camera names one held sign in Urdu or in English.</p>
            <p className="lede">Type a line if you want it kept on screen. Sign video for that line is not in yet.</p>
            <div className="hero-actions">
              <Link className="btn" to={studio}>Start the studio</Link>
              <a className="btn btn-quiet" href="#directions">See both directions</a>
            </div>
          </div>

          <div className="studio-frame" aria-hidden="true">
            <div className="studio-top">
              <strong>Sign to text</strong>
              <span className="chip">Urdu</span>
            </div>
            <div className="studio-stage">Camera off</div>
            <div className="studio-bar">
              <span>Camera stays off until you open the studio.</span>
            </div>
            <div className="result-block">
              <span className="field-label">Result</span>
              <p>Nothing yet.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="directions">
        <div className="wrap">
          <h2>Two directions</h2>
          <p className="section-copy">One box reads a sign. The other keeps a sentence you write.</p>
          <div className="split">
            <article className="panel">
              <h3>Read a sign</h3>
              <p>Turn the camera on, hold one sign, and press Translate. You get the word, and how sure the guess is.</p>
            </article>
            <article className="panel">
              <h3>Keep a typed line</h3>
              <p>Write in English or Urdu. The studio leaves that line on screen. It does not play a sign for it yet.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="band" id="camera">
        <div className="wrap">
          <h2>What the camera needs</h2>
          <ul className="plain-list">
            <li>Light on the hand, not from behind you.</li>
            <li>The hand inside the frame.</li>
            <li>Hold the sign for about two seconds, then press Translate.</li>
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Start the studio</h2>
          <p className="section-copy">It runs in the browser. The camera asks for permission, and you need an account.</p>
          <Link className="btn" to={studio}>Start the studio</Link>
        </div>
      </section>
    </>
  );
}
