
const GamePlanningModal = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="h-full overflow-y-auto">
        <div className="min-h-screen bg-gray-50">
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Game Planning</h1>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          <GamePlanningApp user={user} />
        </div>
      </div>
    </div>
  );
};

export default GamePlanningModal;