export const SkeletonGridCard = () => (
  <div className="bg-white rounded-2xl border border-gray-200 p-4 h-full animate-pulse flex flex-col">
    <div className="aspect-square mb-4 bg-gray-200 rounded-xl"></div>
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2 mt-auto"></div>
  </div>
);

export const SkeletonListRow = () => (
  <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-4 animate-pulse">
    <div className="w-6 h-6 bg-gray-200 rounded shrink-0"></div>
    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    <div className="h-4 bg-gray-200 rounded w-1/6 hidden sm:block ml-auto"></div>
    <div className="h-4 bg-gray-200 rounded w-1/6 hidden md:block"></div>
    <div className="h-6 bg-gray-200 rounded w-6 ml-auto"></div>
  </div>
);
