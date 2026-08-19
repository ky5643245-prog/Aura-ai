import {
  Plus,
  Search,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";

export default function Sidebar({
  conversations = [],
  activeId,
  onSelect,
  onNew,
  onRefresh,
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onClose,
  user,
}) {
  return (
    <aside
      className={`aura-sidebar ${
        collapsed ? "aura-sidebar-collapsed" : ""
      } ${mobileOpen ? "aura-sidebar-mobile-open" : ""}`}
    >
      {/* HEADER */}
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-brand">
            <div className="brand-mark">
              ✦
            </div>

            <span>AURA</span>
          </div>
        )}

        <button
          className="sidebar-icon-btn"
          type="button"
          onClick={onToggle}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
        </button>

        {mobileOpen && (
          <button
            className="sidebar-icon-btn mobile-close"
            type="button"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        )}
      </div>

      {/* NEW CHAT */}
      <div className="sidebar-main-actions">
        <button
          type="button"
          className="new-chat-btn"
          onClick={onNew}
        >
          <Plus size={18} />

          {!collapsed && (
            <span>New chat</span>
          )}
        </button>
      </div>

      {/* SEARCH */}
      {!collapsed && (
        <div className="sidebar-search">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search chats"
            aria-label="Search chats"
          />

          <kbd>⌘K</kbd>
        </div>
      )}

      {/* CHAT LIST */}
      <div className="sidebar-content">
        {!collapsed && (
          <div className="sidebar-section-title">
            <span>Chats</span>

            <span className="chat-count">
              {conversations.length}
            </span>
          </div>
        )}

        <div className="conversation-list">
          {conversations.length === 0 ? (
            !collapsed && (
              <div className="empty-chats">
                <MessageSquare size={19} />

                <span>
                  No conversations yet
                </span>

                <small>
                  Start a new chat to begin.
                </small>
              </div>
            )
          ) : (
            conversations.map((conversation) => {
              const active =
                conversation.id === activeId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-item ${
                    active ? "active" : ""
                  }`}
                  onClick={() => {
                    onSelect(conversation.id);
                    onClose?.();
                  }}
                  title={
                    collapsed
                      ? conversation.title || "New chat"
                      : undefined
                  }
                >
                  <MessageSquare
                    size={17}
                    className="conversation-icon"
                  />

                  {!collapsed && (
                    <>
                      <span className="conversation-title">
                        {conversation.title ||
                          "New chat"}
                      </span>

                      {active && (
                        <MoreHorizontal
                          size={17}
                          className="conversation-more"
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* BOTTOM */}
      <div className="sidebar-bottom">
        {!collapsed && (
          <button
            type="button"
            className="sidebar-bottom-btn danger"
            onClick={() => {
              const confirmed =
                window.confirm(
                  "Delete all conversations?"
                );

              if (!confirmed) return;

              window.dispatchEvent(
                new Event("aura-clear-history")
              );
            }}
          >
            <Trash2 size={17} />

            <span>Clear conversations</span>
          </button>
        )}

        {/* USER */}
        <div className="sidebar-user">
          <div className="user-avatar">
            {(
              user?.name ||
              user?.email ||
              "A"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          {!collapsed && (
            <div className="user-info">
              <strong>
                {user?.name ||
                  "AURA User"}
              </strong>

              <span>
                {user?.email ||
                  "Local account"}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}