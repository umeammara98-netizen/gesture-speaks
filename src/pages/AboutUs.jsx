import { Link } from 'react-router-dom';

export default function AboutUs() {
  return (
    <section className="screen">
      <div className="wrap">
        <h1>About the studio</h1>
        <p className="lede">
          Gesture Speaks is a student project for Pakistani Sign Language.
          In the studio, the camera names one held sign in Urdu or English.
          A typed line stays as text.
        </p>
        <p className="section-copy">
          It runs in the browser when the local server is on.
        </p>
        <Link className="btn" to="/signup">Start the studio</Link>
      </div>
    </section>
  );
}
