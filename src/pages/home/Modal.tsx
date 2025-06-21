export default function Modal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#3a2410] to-[#2a1a0c] border-2 border-amber-500 rounded-xl p-8 max-w-md mx-4 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-3xl font-winky font-bold text-amber-400 mb-6 text-center">
          Coming Soon!
        </h2>
        <p className="text-amber-200 mb-8 text-center font-body">
          The Ronin Wallet login functionality is currently under development
          and will be available soon.
        </p>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-600 text-[#1a0d00] py-3 px-6 rounded-lg font-medium transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
