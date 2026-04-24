import React, { useState } from "react";
import { MenuConfig, AnyMenuItem, MenuItemType } from "@/types/TenantConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit2, ChevronRight, ChevronDown } from "lucide-react";

interface MenuBuilderProps {
  value: MenuConfig;
  onChange: (value: MenuConfig) => void;
}

const MenuItemEditor: React.FC<{
  item: AnyMenuItem;
  onSave: (item: AnyMenuItem) => void;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
  const [editedItem, setEditedItem] = useState<AnyMenuItem>({ ...item });

  const handleChange = (field: keyof AnyMenuItem, val: any) => {
    setEditedItem((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-3 p-4 border rounded-md bg-muted/20">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>ID</Label>
          <Input
            value={editedItem.id}
            onChange={(e) => handleChange("id", e.target.value)}
          />
        </div>
        <div>
          <Label>Label</Label>
          <Input
            value={editedItem.label}
            onChange={(e) => handleChange("label", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input
          value={editedItem.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </div>
      <div>
        <Label>Type</Label>
        <Select
          value={editedItem.type}
          onValueChange={(val) => handleChange("type", val)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submenu">Submenu</SelectItem>
            <SelectItem value="ticket_category">Ticket Category</SelectItem>
            <SelectItem value="link">Link</SelectItem>
            <SelectItem value="action">Action</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {editedItem.type === "ticket_category" && (
        <div>
          <Label>Ticket Category Slug</Label>
          <Input
            value={(editedItem as any).ticket_category || ""}
            onChange={(e) => handleChange("ticket_category", e.target.value)}
          />
        </div>
      )}
      {editedItem.type === "link" && (
        <div>
          <Label>URL</Label>
          <Input
            value={(editedItem as any).url || ""}
            onChange={(e) => handleChange("url", e.target.value)}
          />
        </div>
      )}
      {editedItem.type === "action" && (
        <div>
          <Label>Action Name</Label>
          <Input
            value={(editedItem as any).action || ""}
            onChange={(e) => handleChange("action", e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(editedItem)}>
          Save
        </Button>
      </div>
    </div>
  );
};

const MenuList: React.FC<{
  items: AnyMenuItem[];
  onUpdate: (items: AnyMenuItem[]) => void;
  onEditSubmenu?: (itemId: string) => void;
  level?: number;
}> = ({ items, onUpdate, onEditSubmenu, level = 0 }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleDelete = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onUpdate(newItems);
  };

  const handleSaveItem = (index: number, newItem: AnyMenuItem) => {
    const newItems = [...items];
    newItems[index] = newItem;
    onUpdate(newItems);
    setEditingIndex(null);
  };

  const handleAddItem = () => {
    const newItem: AnyMenuItem = {
      id: `item_${Date.now()}`,
      label: "New Item",
      type: "link",
      url: "#",
    };
    onUpdate([...items, newItem]);
    setEditingIndex(items.length); // Start editing the new item
  };

  return (
    <div className={`space-y-2 ${level > 0 ? "ml-4 border-l pl-4" : ""}`}>
      {items.map((item, index) => (
        <div key={item.id || index} className="group">
          {editingIndex === index ? (
            <MenuItemEditor
              item={item}
              onSave={(newItem) => handleSaveItem(index, newItem)}
              onCancel={() => setEditingIndex(null)}
            />
          ) : (
            <div className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {item.type}
                </span>
                {item.type === "submenu" && onEditSubmenu && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onEditSubmenu(item.id)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditingIndex(index)}
                >
                  <Edit2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={handleAddItem}
      >
        <Plus size={14} className="mr-2" /> Add Item
      </Button>
    </div>
  );
};

const MenuBuilder: React.FC<MenuBuilderProps> = ({ value, onChange }) => {
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);

  const handleMainMenuUpdate = (newItems: AnyMenuItem[]) => {
    onChange({ ...value, main_menu: newItems });
  };

  const handleSubmenuUpdate = (submenuId: string, newItems: AnyMenuItem[]) => {
    onChange({
      ...value,
      submenus: {
        ...value.submenus,
        [submenuId]: newItems,
      },
    });
  };

  // Breadcrumb navigation logic
  const activeSubmenuLabel = activeSubmenuId
    ? value.main_menu.find((i) => i.id === activeSubmenuId)?.label ||
      Object.values(value.submenus)
        .flat()
        .find((i) => i.id === activeSubmenuId)?.label ||
      activeSubmenuId
    : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 border-b mb-3">
        <CardTitle className="text-lg flex items-center gap-2">
           <Button
             variant="ghost"
             size="sm"
             className={activeSubmenuId ? "text-muted-foreground" : "font-bold"}
             onClick={() => setActiveSubmenuId(null)}
           >
             Main Menu
           </Button>
           {activeSubmenuId && (
             <>
               <ChevronRight size={16} className="text-muted-foreground" />
               <span className="font-bold">{activeSubmenuLabel}</span>
             </>
           )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activeSubmenuId ? (
          <MenuList
            items={value.main_menu}
            onUpdate={handleMainMenuUpdate}
            onEditSubmenu={setActiveSubmenuId}
          />
        ) : (
          <MenuList
            items={value.submenus[activeSubmenuId] || []}
            onUpdate={(items) => handleSubmenuUpdate(activeSubmenuId, items)}
            onEditSubmenu={setActiveSubmenuId} // Allow nested submenus if needed
          />
        )}
      </CardContent>
    </Card>
  );
};

export default MenuBuilder;
