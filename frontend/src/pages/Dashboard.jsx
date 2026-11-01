
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Users,
  ArrowUpRight
} from "lucide-react";

function Dashboard() {

  const stats = [
    {
      title: "Total Projects",
      value: "12",
      change: "+2 this month",
      icon: FolderKanban,
      color: "blue"
    },
    {
      title: "Completed Tasks",
      value: "48",
      change: "+12 this week",
      icon: CheckCircle2,
      color: "green"
    },
    {
      title: "Pending Tasks",
      value: "16",
      change: "5 due soon",
      icon: Clock,
      color: "orange"
    },
    {
      title: "Team Members",
      value: "8",
      change: "Across all projects",
      icon: Users,
      color: "purple"
    }
  ];

  const projects = [
    {
      name: "Website Redesign",
      description: "Redesigning the company website",
      progress: 75,
      color: "bg-blue-600"
    },
    {
      name: "Mobile Application",
      description: "Developing a mobile application",
      progress: 45,
      color: "bg-purple-600"
    },
    {
      name: "Marketing Campaign",
      description: "Planning the next campaign",
      progress: 90,
      color: "bg-green-600"
    }
  ];

  const tasks = [
    {
      title: "Design login page",
      project: "Website Redesign",
      priority: "High",
      status: "In Progress"
    },
    {
      title: "Create database schema",
      project: "Mobile Application",
      priority: "Medium",
      status: "Pending"
    },
    {
      title: "Review landing page",
      project: "Website Redesign",
      priority: "Low",
      status: "Completed"
    }
  ];

  return (

    <div className="p-8 space-y-8">

      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Welcome back, Krish!
        </h1>

        <p className="text-slate-500 mt-2">
          Here's what's happening with your projects today.
        </p>
      </div>


      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {stats.map((stat) => {

          const Icon = stat.icon;

          const colors = {
            blue: "bg-blue-100 text-blue-600",
            green: "bg-green-100 text-green-600",
            orange: "bg-orange-100 text-orange-600",
            purple: "bg-purple-100 text-purple-600"
          };

          return (

            <div
              key={stat.title}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >

              <div className="flex justify-between items-center">

                <p className="text-sm text-slate-500">
                  {stat.title}
                </p>

                <div className={`p-3 rounded-xl ${colors[stat.color]}`}>
                  <Icon size={21} />
                </div>

              </div>

              <h2 className="text-3xl font-bold text-slate-800 mt-4">
                {stat.value}
              </h2>

              <p className="text-xs text-slate-400 mt-2">
                {stat.change}
              </p>

            </div>

          );

        })}

      </div>


      {/* Projects Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <div className="flex justify-between items-center mb-6">

          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Recent Projects
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Track your ongoing projects
            </p>
          </div>

          <button className="text-blue-600 text-sm font-semibold flex items-center gap-1">
            View All
            <ArrowUpRight size={16} />
          </button>

        </div>


        <div className="space-y-6">

          {projects.map((project) => (

            <div key={project.name}>

              <div className="flex justify-between mb-2">

                <div>
                  <h3 className="font-semibold text-slate-700">
                    {project.name}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {project.description}
                  </p>
                </div>

                <span className="text-sm font-semibold text-slate-600">
                  {project.progress}%
                </span>

              </div>

              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">

                <div
                  className={`h-full rounded-full ${project.color}`}
                  style={{ width: `${project.progress}%` }}
                />

              </div>

            </div>

          ))}

        </div>

      </div>


      {/* Task Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">

        <h2 className="text-xl font-bold text-slate-800 mb-5">
          Recent Tasks
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="py-3">Task</th>
                <th className="py-3">Project</th>
                <th className="py-3">Priority</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>

            <tbody>

              {tasks.map((task) => (

                <tr
                  key={task.title}
                  className="border-b border-slate-50 text-sm"
                >

                  <td className="py-4 font-medium text-slate-700">
                    {task.title}
                  </td>

                  <td className="py-4 text-slate-500">
                    {task.project}
                  </td>

                  <td className="py-4">
                    {task.priority}
                  </td>

                  <td className="py-4">
                    {task.status}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

}

export default Dashboard;
