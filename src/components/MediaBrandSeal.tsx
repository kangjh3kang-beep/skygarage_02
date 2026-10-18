import { emblem, wordmark } from '../sgp/assets/approved-brand';
import './media-brand-seal.css';

/** Keep the supplied artwork intact; never redraw or generate the brand mark. */
export default function MediaBrandSeal() {
  return <span className="doelv-media-seal" aria-hidden="true">
    <img className="doelv-media-emblem" src={emblem} width={200} height={178} alt="" />
    <img className="doelv-media-wordmark" src={wordmark} width={650} height={232} alt="" />
  </span>;
}
