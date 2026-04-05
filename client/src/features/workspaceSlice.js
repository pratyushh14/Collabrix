import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../configs/api";

// ✅ FETCH WORKSPACES
export const fetchWorkspaces = createAsyncThunk(
  "workspace/fetchWorkspaces",
  async ({ getToken }) => {
    try {
      const { data } = await api.get("/api/workspaces", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      return data || [];
    } catch (error) {
      console.log(error?.response?.data?.message || error.message);
      return [];
    }
  }
);

// ✅ SYNC WORKSPACE MEMBERS
export const syncWorkspaceMembersThunk = createAsyncThunk(
  "workspace/syncWorkspaceMembers",
  async ({ workspaceId, getToken }, { dispatch }) => {
    try {
      await api.post(`/api/workspaces/${workspaceId}/sync-members`, {}, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      // Optionally re-fetch workspaces to reflect new members
      dispatch(fetchWorkspaces({ getToken }));
      return true;
    } catch (error) {
      console.log(error?.response?.data?.message || error.message);
      throw error;
    }
  }
);

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  hasFetched: false,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,

  reducers: {
    setWorkspaces: (state, action) => {
      state.workspaces = action.payload;
    },

    // ✅ FIXED WORKSPACE SWITCHING
    setCurrentWorkspace: (state, action) => {
      const workspaceId = action.payload?.id || action.payload;

      localStorage.setItem("currentWorkspaceId", workspaceId);

      state.currentWorkspace =
        state.workspaces.find((w) => w.id === workspaceId) || null;
    },

    addWorkspace: (state, action) => {
      state.workspaces.push(action.payload);

      // auto-select newly created workspace
      state.currentWorkspace = action.payload;
      localStorage.setItem("currentWorkspaceId", action.payload.id);
    },

    updateWorkspace: (state, action) => {
      state.workspaces = state.workspaces.map((w) =>
        w.id === action.payload.id ? action.payload : w
      );

      if (state.currentWorkspace?.id === action.payload.id) {
        state.currentWorkspace = action.payload;
      }
    },

    deleteWorkspace: (state, action) => {
      state.workspaces = state.workspaces.filter(
        (w) => w.id !== action.payload
      );

      // reset current workspace if deleted
      if (state.currentWorkspace?.id === action.payload) {
        state.currentWorkspace = state.workspaces[0] || null;
      }
    },

    addProject: (state, action) => {
      if (!state.currentWorkspace) return;

      state.currentWorkspace.projects.push(action.payload);

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? { ...w, projects: [...w.projects, action.payload] }
          : w
      );
    },

    addTask: (state, action) => {
      if (!state.currentWorkspace) return;

      state.currentWorkspace.projects =
        state.currentWorkspace.projects.map((p) => {
          if (p.id === action.payload.projectId) {
            return { ...p, tasks: [...p.tasks, action.payload] };
          }
          return p;
        });

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: w.projects.map((p) =>
                p.id === action.payload.projectId
                  ? { ...p, tasks: [...p.tasks, action.payload] }
                  : p
              ),
            }
          : w
      );
    },

    updateTask: (state, action) => {
      if (!state.currentWorkspace) return;

      state.currentWorkspace.projects =
        state.currentWorkspace.projects.map((p) => {
          if (p.id === action.payload.projectId) {
            return {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === action.payload.id ? action.payload : t
              ),
            };
          }
          return p;
        });

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: w.projects.map((p) =>
                p.id === action.payload.projectId
                  ? {
                      ...p,
                      tasks: p.tasks.map((t) =>
                        t.id === action.payload.id ? action.payload : t
                      ),
                    }
                  : p
              ),
            }
          : w
      );
    },

    deleteTask: (state, action) => {
      if (!state.currentWorkspace) return;

      state.currentWorkspace.projects =
        state.currentWorkspace.projects.map((p) => ({
          ...p,
          tasks: p.tasks.filter((t) => !action.payload.includes(t.id)),
        }));

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: w.projects.map((p) => ({
                ...p,
                tasks: p.tasks.filter((t) =>
                  !action.payload.includes(t.id)
                ),
              })),
            }
          : w
      );
    },

    updateProject: (state, action) => {
      if (!state.currentWorkspace) return;
      state.currentWorkspace.projects =
        state.currentWorkspace.projects.map((p) =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        );
      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: w.projects.map((p) =>
                p.id === action.payload.id ? { ...p, ...action.payload } : p
              ),
            }
          : w
      );
    },

    addProjectMember: (state, action) => {
      if (!state.currentWorkspace) return;
      const { projectId, member } = action.payload;
      state.currentWorkspace.projects =
        state.currentWorkspace.projects.map((p) =>
          p.id === projectId
            ? { ...p, members: [...p.members, member] }
            : p
        );
      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: w.projects.map((p) =>
                p.id === projectId
                  ? { ...p, members: [...p.members, member] }
                  : p
              ),
            }
          : w
      );
    },
  },

  extraReducers: (builder) => {
    builder.addCase(fetchWorkspaces.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
      state.hasFetched = true;
      state.loading = false;
      state.workspaces = action.payload;

      if (action.payload.length > 0) {
        const savedId = localStorage.getItem("currentWorkspaceId");

        const selectedWorkspace = action.payload.find(
          (w) => w.id === savedId
        );

        state.currentWorkspace =
          selectedWorkspace ?? action.payload[0] ?? null;
      }
    });

    builder.addCase(fetchWorkspaces.rejected, (state) => {
      state.hasFetched = true;
      state.loading = false;
    });
  },
});

export const {
  setWorkspaces,
  setCurrentWorkspace,
  addWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addProject,
  updateProject,
  addTask,
  updateTask,
  deleteTask,
  addProjectMember,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;