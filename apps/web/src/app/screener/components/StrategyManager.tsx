import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, BookOpen, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { SavedStrategyDto as SavedStrategy } from "shared";

interface StrategyManagerProps {
  locale: string;
  strategies: SavedStrategy[];
  customCategories: string[];
  groupedStrategies: Record<string, SavedStrategy[]>;
  dragOverCategory: string | null;
  dragOverStrategyId: string | null;
  handleLoadStrategy: (strat: SavedStrategy) => void;
  handleDeleteStrategy: (id: string, name: string) => void;
  handleAddCategory: (name: string) => void;
  handleDeleteCategory: (name: string) => void;
  handleMoveCategory: (name: string, direction: "up" | "down") => void;
  handleDragStartCategory: (e: React.DragEvent, categoryName: string) => void;
  handleDragStart: (e: React.DragEvent, strategyId: string) => void;
  handleDragOverStrategy: (e: React.DragEvent, id: string) => void;
  handleDragLeaveStrategy: () => void;
  handleDragOverCategoryContainer: (e: React.DragEvent, categoryName: string) => void;
  handleDragLeaveCategoryContainer: () => void;
  handleDropOnCategory: (e: React.DragEvent, targetCategory: string) => void;
  handleDropOnStrategy: (e: React.DragEvent, targetStrategyId: string) => void;
}

export function StrategyManager({
  locale,
  strategies,
  customCategories,
  groupedStrategies,
  dragOverCategory,
  dragOverStrategyId,
  handleLoadStrategy,
  handleDeleteStrategy,
  handleAddCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleDragStartCategory,
  handleDragStart,
  handleDragOverStrategy,
  handleDragLeaveStrategy,
  handleDragOverCategoryContainer,
  handleDragLeaveCategoryContainer,
  handleDropOnCategory,
  handleDropOnStrategy,
}: StrategyManagerProps) {
  return (
    <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-100 hover-premium">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            {locale === "zh-TW" ? "我的策略清單" : "Saved Strategies"}
          </CardTitle>
          <CardDescription>
            {locale === "zh-TW"
              ? "支援分類管理與拖曳排序。拖曳策略可變更分類或調整順序。"
              : "Supports category grouping and drag-and-drop reordering."}
          </CardDescription>
        </div>

        {/* 新增分類 Form */}
        <div className="flex items-center gap-2 max-w-xs w-full sm:w-auto">
          <Input
            placeholder={locale === "zh-TW" ? "新增分類名稱..." : "New category..."}
            id="newCategoryName"
            className="h-8 text-xs bg-zinc-950 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value;
                handleAddCategory(val);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer shrink-0"
            onClick={() => {
              const input = document.getElementById("newCategoryName") as HTMLInputElement;
              if (input) {
                handleAddCategory(input.value);
                input.value = "";
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4 max-h-[400px] overflow-y-auto">
        {Object.keys(groupedStrategies).map((catName) => {
          const strats = groupedStrategies[catName];
          const isUncategorized = catName === "未分類" || catName === "Uncategorized";
          if (isUncategorized && strats.length === 0) return null;

          const isOver = dragOverCategory === catName;

          return (
            <div
              key={catName}
              onDragOver={(e) => handleDragOverCategoryContainer(e, catName)}
              onDragLeave={handleDragLeaveCategoryContainer}
              onDrop={(e) => handleDropOnCategory(e, catName)}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                isOver
                  ? "bg-indigo-500/10 border-indigo-500/50 shadow-md"
                  : "bg-zinc-900/20 light:bg-slate-100/30 border-zinc-800/40 light:border-zinc-200/60"
              }`}
            >
              {/* 分類標題 */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 light:border-zinc-200/60">
                <span
                  className={`text-xs font-bold text-indigo-400 light:text-indigo-600 flex items-center gap-1.5 ${
                    !isUncategorized ? "cursor-grab active:cursor-grabbing select-none" : ""
                  }`}
                  draggable={!isUncategorized}
                  onDragStart={(e) => !isUncategorized && handleDragStartCategory(e, catName)}
                >
                  {!isUncategorized && <GripVertical className="h-3.5 w-3.5 text-indigo-400/70" />}
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {catName} ({strats.length})
                </span>
                {!isUncategorized && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={customCategories.indexOf(catName) === 0}
                      onClick={() => handleMoveCategory(catName, "up")}
                      className="text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 h-5 w-5 p-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title={locale === "zh-TW" ? "上移分類" : "Move up"}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={customCategories.indexOf(catName) === customCategories.length - 1}
                      onClick={() => handleMoveCategory(catName, "down")}
                      className="text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 h-5 w-5 p-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title={locale === "zh-TW" ? "下移分類" : "Move down"}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(catName)}
                      className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-5 w-5 p-0 cursor-pointer"
                      title={locale === "zh-TW" ? "刪除此分類" : "Delete category"}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* 策略列表 */}
              <div className="space-y-1.5 min-h-[40px] transition-colors duration-150">
                {strats.length === 0 ? (
                  <div className="text-center py-2 text-[10px] text-zinc-500 italic">
                    {locale === "zh-TW" ? "拖曳策略至此分類" : "Drag strategies here"}
                  </div>
                ) : (
                  strats.map((strat) => {
                    const isDragOverThis = dragOverStrategyId === strat.id;
                    return (
                      <div
                        key={strat.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, strat.id)}
                        onDragOver={(e) => handleDragOverStrategy(e, strat.id)}
                        onDragLeave={handleDragLeaveStrategy}
                        onDrop={(e) => handleDropOnStrategy(e, strat.id)}
                        className={`flex items-center justify-between p-2 rounded bg-zinc-900/40 light:bg-white hover:bg-zinc-900/80 light:hover:bg-zinc-50 border transition-all duration-150 ${
                          isDragOverThis
                            ? "border-t-2 border-t-indigo-500 border-zinc-800 light:border-zinc-200"
                            : "border-zinc-800/40 light:border-zinc-200"
                        }`}
                        style={{ cursor: "grab" }}
                      >
                        <button
                          onClick={() => handleLoadStrategy(strat)}
                          className="font-medium text-left truncate flex-1 hover:text-indigo-400 cursor-pointer text-xs text-zinc-200 light:text-zinc-800 flex items-center gap-1.5"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          {strat.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStrategy(strat.id, strat.name)}
                          className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
