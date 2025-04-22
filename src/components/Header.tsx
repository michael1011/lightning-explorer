import { Link } from "react-router";

export default function Header() {
  return (
    <div className="flex justify-between items-center p-4">
      <Link to="/">
        <h2 className="font-bold">Lightning Explorer</h2>
      </Link>
    </div>
  );
}
