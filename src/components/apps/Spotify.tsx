import { SPOTIFY_URL } from '../../apps';

/**
 * Spotify only allows its /embed/ pages inside iframes — regular share
 * links send X-Frame-Options/CSP headers that block framing. Convert
 * any share link (track/album/playlist/episode) to the embed form.
 */
function toEmbedUrl(url: string): string {
  const embedded = url.includes('/embed/')
    ? url
    : url.replace(
        /open\.spotify\.com\/(track|album|playlist|episode|show|artist)\//,
        'open.spotify.com/embed/$1/',
      );
  return `${embedded}${embedded.includes('?') ? '&' : '?'}utm_source=generator`;
}

export default function Spotify() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <iframe
        title="Spotify player"
        src={toEmbedUrl(SPOTIFY_URL)}
        className="min-h-0 w-full flex-1 rounded-xl border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
      <p className="shrink-0 text-center text-[11px] text-body-muted">
        Log in to Spotify for full tracks.
      </p>
    </div>
  );
}
