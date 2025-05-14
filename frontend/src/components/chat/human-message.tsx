import { cn } from "@/lib/utils";
import { Message } from "@/types/message";
import { Check, Copy, Pencil } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";

interface HumanMessageProps {
  msg: Message;
  isCopied: boolean;
  onCopy: (text: string, id: string) => void;
  onEdit?: (newContent: string, id: string) => void;
  isEditing?: boolean;
}

export const HumanMessage: React.FC<HumanMessageProps> = ({
  msg,
  isCopied,
  onCopy,
  onEdit,
  isEditing = false
}) => {
  const [editing, setEditing] = React.useState(isEditing);
  const [editValue, setEditValue] = React.useState(msg.content || "");

  React.useEffect(() => {
    setEditValue(msg.content || "");
  }, [msg.content]);

  const handleSave = () => {
    if (onEdit) {
      onEdit(editValue, msg.id);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditValue(msg.content || "");
    setEditing(false);
  };

  return (
    <div className={cn("flex justify-end", {
      "w-full": editing,
    })}>
      <div className={cn(
        "max-w-sm sm:max-w-md md:max-w-lg relative group",
        {
          "w-full": editing,
        }
      )}>
        <div className={cn("px-4 py-2 rounded-tr-sm bg-primary text-primary-foreground rounded-xl", {
          "w-full": editing,
        })}>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full max-w-full p-2.5 text-white rounded-lg resize-none bg-[#711c2a] focus:outline-none"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" className="bg-primary/80 text-primary-foreground" onClick={handleCancel}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save</Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">
              {msg.content || "..."}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button
            onClick={() => onCopy(msg.content || "", msg.id)}
            variant="ghost"
            size="icon"
            title="Copy to clipboard"
            className="w-6 h-6 opacity-0 group-hover:opacity-100"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
              </>
            )}
          </Button>
          {!editing && onEdit && (
            <Button
              onClick={() => setEditing(true)}
              variant="ghost"
              size="icon"
              title="Edit message"
              className="w-6 h-6 opacity-0 group-hover:opacity-100"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 