
function Tasks() {

  const tasks = [
    { name: "Design login page", priority: "High", status: "In Progress" },
    { name: "Create database schema", priority: "Medium", status: "Pending" },
    { name: "Review landing page", priority: "Low", status: "Completed" }
  ];

  return (
    <div className="p-8">

      <h1 className="text-3xl font-bold text-slate-800">
        My Tasks
      </h1>

      <p className="text-slate-500 mt-2 mb-8">
        Organize and track your daily tasks.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">

        {tasks.map((task) => (

          <div
            key={task.name}
            className="flex justify-between items-center py-5 border-b border-slate-100"
          >

            <div>
              <h3 className="font-semibold text-slate-700">
                {task.name}
              </h3>

              <p className="text-sm text-slate-400 mt-1">
                Priority: {task.priority}
              </p>
            </div>

            <span className="text-sm text-blue-600 font-medium">
              {task.status}
            </span>

          </div>

        ))}

      </div>

    </div>
  );
}

export default Tasks;
