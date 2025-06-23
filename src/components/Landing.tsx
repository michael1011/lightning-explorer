import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "react-router";

import { isChannelId, isPubkey, isToBeResolved } from "../lib/utils";

function Landing() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const execute = () => {
    if (isPubkey(search)) {
      navigate(`/node/${search}`);
    } else if (isChannelId(search)) {
      navigate(`/channel/${search}`);
    } else if (isToBeResolved(search)) {
      navigate(`/resolver/${encodeURIComponent(search)}`);
    } else {
      navigate(`/search/${search}`);
    }
  };

  return (
    <>
      <div className="m-8">
        <div className="flex flex-col items-center justify-center gap-4 max-w-2xl mx-auto h-[calc(100vh-4rem)] my-auto">
          <h1 className="text-4xl font-bold">Lightning Explorer</h1>
          <Input
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                execute();
              }
            }}
          />
          <Button onClick={execute}>Search</Button>
        </div>
      </div>
    </>
  );
}

export default Landing;
