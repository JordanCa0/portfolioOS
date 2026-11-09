import { contentUrl } from '../../../lib/blog/github';
import { useBlogContext } from './BlogContext';

export default function ImageViewer({ path }: { path: string }) {
  const { blog } = useBlogContext();
  return (
    <div className="grid h-full place-items-center overflow-auto p-4">
      <img
        src={blog.localImages.get(path) ?? contentUrl(path, !!blog.author)}
        alt={path}
        className="max-h-full max-w-full rounded border border-edge object-contain shadow-lg"
      />
    </div>
  );
}
