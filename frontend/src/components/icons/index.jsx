const pixels = {
  dashboard: ["1010101", "1111111", "1000101", "1110101", "1010101", "1111111", "1010101"],
  folder: ["0000000", "1100000", "1111110", "1000010", "1011110", "1000010", "1111110"],
  check: ["0000000", "0000010", "0000101", "1001010", "0110100", "0000000", "0000000"],
  checkCircle: ["0111110", "1100011", "1000001", "1000011", "0100110", "0011100", "0001000"],
  clock: ["0111110", "1100011", "1000101", "1001101", "1000001", "1100011", "0111110"],
  users: ["0111000", "0101000", "0111000", "0000000", "1101011", "1010101", "1111111"],
  arrowUp: ["0000100", "0001100", "0010100", "0100100", "1000100", "0000100", "0000100"],
  warning: ["0001000", "0011100", "0010100", "0110110", "0100010", "1111111", "0000000"],
  trend: ["1000001", "0100010", "0010100", "0001000", "0010100", "0100010", "1000001"],
  calendar: ["1111111", "1000001", "1111111", "1010101", "1010101", "1000001", "1111111"],
  document: ["1111100", "1000110", "1010101", "1000101", "1010101", "1000110", "1111100"],
  list: ["1100011", "1111111", "1100011", "1111111", "1100011", "1111111", "1100011"],
  sparkle: ["0001000", "0101010", "0011100", "1111111", "0011100", "0101010", "0001000"],
  chat: ["1111111", "1000001", "1011101", "1011101", "1000001", "1111111", "0011000"],
  user: ["0011100", "0111110", "0111110", "0011100", "0000000", "0111110", "1111111"],
  search: ["0011100", "0100010", "1000001", "1000001", "0100010", "0011100", "0000011"],
  plus: ["0001000", "0001000", "0001000", "1111111", "0001000", "0001000", "0001000"],
  trash: ["0011100", "1111111", "1010101", "1010101", "1010101", "1000001", "1111111"],
  pencil: ["0000001", "0000011", "0000110", "0001100", "0011000", "0110000", "1100000"],
  circle: ["0011100", "0100010", "1000001", "1000001", "1000001", "0100010", "0011100"],
  send: ["1000000", "1100000", "1111111", "1111111", "1100000", "1000000", "0000000"],
  activity: ["1000001", "1000001", "1010101", "1010101", "0011100", "0001000", "0001000"],
  branch: ["1100000", "1010000", "1001000", "0000100", "0000010", "0000001", "0000001"],
  link: ["0011000", "0100100", "1000010", "1000010", "0100100", "0001100", "0000000"],
  tags: ["0111110", "1100011", "1000101", "1000101", "1100011", "0111110", "0000000"],
  bell: ["0011100", "0111110", "1100011", "1100011", "1111111", "0011100", "0001000"],
  clip: ["0111110", "0100010", "0101010", "0101010", "0101010", "0100000", "0110000"],
  download: ["0001000", "0001000", "0001000", "0101010", "0011100", "0001000", "1111111"],
  refresh: ["0011110", "0100001", "1000000", "1000011", "0100010", "0011110", "0001000"],
  shield: ["1111111", "1000001", "1000001", "0100010", "0010100", "0001000", "0000000"],
  workflow: ["1000001", "0100010", "0010100", "0001000", "0010100", "0100010", "1000001"],
  mail: ["1111111", "1000001", "1011011", "1010101", "1001001", "1000001", "1111111"],
  bot: ["0011100", "1111111", "1010101", "1111111", "0111110", "0100010", "0111110"],
  camera: ["0011100", "1111111", "1000001", "1011101", "1010101", "1000001", "1111111"],
  sun: ["0001000", "0101010", "0011100", "1111111", "0011100", "0101010", "0001000"],
  moon: ["0011110", "0110000", "1100000", "1100000", "1100000", "0110000", "0011110"],
  chevron: ["1000001", "0100010", "0010100", "0001000", "0000000", "0000000", "0000000"],
  minus: ["0000000", "0000000", "0000000", "1111111", "0000000", "0000000", "0000000"],
  redo: ["0011110", "0100001", "0000001", "0001111", "0000001", "0100001", "0011110"],
  undo: ["0111100", "1000010", "1000000", "1111000", "1000000", "1000010", "0111100"],
  arrows: ["1000100", "1100110", "1111111", "0001000", "1111111", "0110011", "0010001"],
  arrowRight: ["0001000", "0001100", "1111111", "1111111", "0001100", "0001000", "0000000"],
  arrowLeft: ["0001000", "0011000", "1111111", "1111111", "0011000", "0001000", "0000000"],
  arrowDown: ["0001000", "0001000", "0001000", "1001001", "0101010", "0011100", "0001000"],
  grid: ["1111111", "1000001", "1011101", "1011101", "1000001", "1111111", "0000000"],
  briefcase: ["0011100", "0010100", "1111111", "1000001", "1011101", "1000001", "1111111"],
  pin: ["0011100", "0111110", "0011100", "0001000", "0001000", "0001000", "0001000"],
  bold: ["1111100", "1000010", "1000010", "1111100", "1000010", "1000010", "1111100"],
  italic: ["0000110", "0001100", "0001100", "0011000", "0011000", "0110000", "0110000"],
  code: ["1000010", "0100100", "0011000", "0011000", "0100100", "1000010", "0000000"],
  table: ["1111111", "1001001", "1111111", "1001001", "1111111", "1001001", "1111111"],
  target: ["0011100", "0100010", "1001001", "1010101", "1001001", "0100010", "0011100"],
  filter: ["1111111", "0100010", "0010100", "0001000", "0001000", "0001000", "0001000"],
  clock3: ["0111110", "1100011", "1000101", "1001101", "1000001", "1100011", "0111110"],
  folderPlus: ["0000000", "1100000", "1111110", "1000010", "1011110", "1011100", "1111100"],
  listPlus: ["1100011", "1111111", "1100011", "1111111", "1100011", "1111111", "0001000"],
  userPlus: ["0011100", "0111110", "0011100", "0000000", "0111100", "1111111", "0111100"],
  fileCode: ["1111100", "1000110", "1010101", "1000101", "1010101", "1000110", "1111100"],
  lightbulb: ["0011100", "0111110", "1100011", "1100011", "0111110", "0011100", "0011100"],
  alert: ["0001000", "0011100", "0110110", "0100010", "0101010", "1111111", "0000000"],
  calendarRange: ["1111111", "1000001", "1111111", "1010101", "1010101", "1000001", "1111111"],
  loader: ["0011100", "0100000", "1000000", "1000000", "0100000", "0010000", "0001110"],
  close: ["1000001", "0100010", "0010100", "0001000", "0010100", "0100010", "1000001"],
  brain: ["0110110", "1101011", "1111111", "1011101", "1111111", "0111110", "0010100"],
  mailPlus: ["1111111", "1000001", "1011011", "1010101", "1001001", "1000001", "1101111"],
  chevronRight: ["1000000", "0100000", "0010000", "0001000", "0010000", "0100000", "1000000"],
  listChecks: ["1100011", "1110011", "1101011", "1111111", "1100011", "1111111", "1100011"],
  heading: ["1111111", "1000001", "1000001", "1111111", "1000001", "1000001", "1000001"],
  help: ["0011100", "0100010", "0000010", "0001100", "0001000", "0000000", "0001000"],
};

const glyphByName = {
  Activity: "activity", AlertCircle: "alert", AlertTriangle: "warning", ArrowDownRight: "arrowDown",
  ArrowLeft: "arrowLeft", ArrowLeftRight: "arrows", ArrowUpRight: "arrowUp", ArrowUpDown: "arrows",
  ArrowRight: "arrowRight", Bell: "bell", Bold: "bold", Bot: "bot", Brain: "brain", BriefcaseBusiness: "briefcase",
  CalendarClock: "calendar", CalendarDays: "calendar", CalendarRange: "calendarRange", Camera: "camera", Check: "check",
  CheckCheck: "listChecks", CheckCircle: "checkCircle", CheckCircle2: "checkCircle", CheckSquare: "check", ChevronDown: "chevron",
  ChevronLeft: "arrowLeft", ChevronRight: "chevronRight", Circle: "circle", CircleHelp: "help", Clock: "clock", Clock3: "clock3",
  ClipboardList: "list", Code2: "code", Download: "download", FileCode2: "fileCode", FileText: "document", Filter: "filter",
  FolderKanban: "folder", FolderPlus: "folderPlus", GitBranch: "branch", Heading2: "heading", Italic: "italic", LayoutDashboard: "dashboard",
  LayoutGrid: "grid", Lightbulb: "lightbulb", Link2: "link", List: "list", ListChecks: "listChecks", ListPlus: "listPlus", ListTodo: "list",
  Loader2: "loader", LoaderCircle: "loader", LogOut: "arrowRight", Mail: "mail", MailPlus: "mailPlus", MessageCircle: "chat", MessageSquare: "chat",
  Minus: "minus", Moon: "moon", Paperclip: "clip", Pencil: "pencil", Pin: "pin", Plus: "plus", RefreshCw: "refresh", Redo2: "redo", Save: "check",
  Search: "search", Send: "send", Shield: "shield", SlidersHorizontal: "filter", Sparkles: "sparkle", StickyNote: "document", Sun: "sun", Tags: "tags",
  Table2: "table", Target: "target", Trash: "trash", Trash2: "trash", TrendingUp: "trend", Undo2: "undo", User: "user", UserPlus: "userPlus",
  UserRound: "user", Users: "users", Workflow: "workflow", X: "close",
};

function PixelIcon({ size = 24, className = "", title, style, "aria-label": ariaLabel, ...props }) {
  const name = props.iconName || "Sparkles";
  const pattern = pixels[glyphByName[name] || "sparkle"];
  const cells = [];

  pattern.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "1") cells.push(<rect key={`${x}-${y}`} x={x * 2 + 1} y={y * 2 + 1} width="2" height="2" />);
    });
  });

  return (
    <svg
      aria-hidden={ariaLabel || title ? undefined : true}
      aria-label={ariaLabel}
      className={className}
      fill="currentColor"
      height={size}
      role={ariaLabel ? "img" : undefined}
      shapeRendering="crispEdges"
      style={style}
      viewBox="0 0 16 16"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {cells}
    </svg>
  );
}

function makeIcon(iconName) {
  return function PixelArtIcon(props) {
    return <PixelIcon {...props} iconName={iconName} />;
  };
}

export const Activity = makeIcon("Activity");
export const AlertCircle = makeIcon("AlertCircle");
export const AlertTriangle = makeIcon("AlertTriangle");
export const ArrowDownRight = makeIcon("ArrowDownRight");
export const ArrowLeft = makeIcon("ArrowLeft");
export const ArrowLeftRight = makeIcon("ArrowLeftRight");
export const ArrowRight = makeIcon("ArrowRight");
export const ArrowUpDown = makeIcon("ArrowUpDown");
export const ArrowUpRight = makeIcon("ArrowUpRight");
export const Bell = makeIcon("Bell");
export const Bold = makeIcon("Bold");
export const Bot = makeIcon("Bot");
export const Brain = makeIcon("Brain");
export const BriefcaseBusiness = makeIcon("BriefcaseBusiness");
export const CalendarClock = makeIcon("CalendarClock");
export const CalendarDays = makeIcon("CalendarDays");
export const CalendarRange = makeIcon("CalendarRange");
export const Camera = makeIcon("Camera");
export const Check = makeIcon("Check");
export const CheckCheck = makeIcon("CheckCheck");
export const CheckCircle = makeIcon("CheckCircle");
export const CheckCircle2 = makeIcon("CheckCircle2");
export const CheckSquare = makeIcon("CheckSquare");
export const ChevronDown = makeIcon("ChevronDown");
export const ChevronLeft = makeIcon("ChevronLeft");
export const ChevronRight = makeIcon("ChevronRight");
export const Circle = makeIcon("Circle");
export const CircleHelp = makeIcon("CircleHelp");
export const Clock = makeIcon("Clock");
export const Clock3 = makeIcon("Clock3");
export const ClipboardList = makeIcon("ClipboardList");
export const Code2 = makeIcon("Code2");
export const Download = makeIcon("Download");
export const FileCode2 = makeIcon("FileCode2");
export const FileText = makeIcon("FileText");
export const Filter = makeIcon("Filter");
export const FolderKanban = makeIcon("FolderKanban");
export const FolderPlus = makeIcon("FolderPlus");
export const GitBranch = makeIcon("GitBranch");
export const Heading2 = makeIcon("Heading2");
export const Italic = makeIcon("Italic");
export const LayoutDashboard = makeIcon("LayoutDashboard");
export const LayoutGrid = makeIcon("LayoutGrid");
export const Lightbulb = makeIcon("Lightbulb");
export const Link2 = makeIcon("Link2");
export const List = makeIcon("List");
export const ListChecks = makeIcon("ListChecks");
export const ListPlus = makeIcon("ListPlus");
export const ListTodo = makeIcon("ListTodo");
export const Loader2 = makeIcon("Loader2");
export const LoaderCircle = makeIcon("LoaderCircle");
export const LogOut = makeIcon("LogOut");
export const Mail = makeIcon("Mail");
export const MailPlus = makeIcon("MailPlus");
export const MessageCircle = makeIcon("MessageCircle");
export const MessageSquare = makeIcon("MessageSquare");
export const Minus = makeIcon("Minus");
export const Moon = makeIcon("Moon");
export const Paperclip = makeIcon("Paperclip");
export const Pencil = makeIcon("Pencil");
export const Pin = makeIcon("Pin");
export const Plus = makeIcon("Plus");
export const RefreshCw = makeIcon("RefreshCw");
export const Redo2 = makeIcon("Redo2");
export const Save = makeIcon("Save");
export const Search = makeIcon("Search");
export const Send = makeIcon("Send");
export const Shield = makeIcon("Shield");
export const SlidersHorizontal = makeIcon("SlidersHorizontal");
export const Sparkles = makeIcon("Sparkles");
export const StickyNote = makeIcon("StickyNote");
export const Sun = makeIcon("Sun");
export const Tags = makeIcon("Tags");
export const Table2 = makeIcon("Table2");
export const Target = makeIcon("Target");
export const Trash = makeIcon("Trash");
export const Trash2 = makeIcon("Trash2");
export const TrendingUp = makeIcon("TrendingUp");
export const Undo2 = makeIcon("Undo2");
export const User = makeIcon("User");
export const UserPlus = makeIcon("UserPlus");
export const UserRound = makeIcon("UserRound");
export const Users = makeIcon("Users");
export const Workflow = makeIcon("Workflow");
export const X = makeIcon("X");
