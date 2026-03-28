import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../configs/api";

export const fetchWorkspaces = createAsyncThunk('workspace/fetchWorkspaces', async ({ getToken }) => {
    try {
        const { data } = await api.get('/api/workspaces', { headers: { Authorization: `Bearer ${await getToken()}` } });
        return data || [];
    } catch (error) {
        console.log(error?.response?.data?.message || error.message);
        return [];
    }
});

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
        setCurrentWorkspace: (state, action) => {
            localStorage.setItem("currentWorkspaceId", action.payload);
            state.currentWorkspace = state.workspaces.find((w) => w.id === action.payload);
        },
        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);
            if (state.currentWorkspace?.id !== action.payload.id) {
                state.currentWorkspace = action.payload;
            }
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
            state.workspaces = state.workspaces.filter((w) => w.id !== action.payload);
        },
        addProject: (state, action) => {
            state.currentWorkspace.projects.push(action.payload);
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? { ...w, projects: w.projects.concat(action.payload) } : w
            );
        },
        addTask: (state, action) => {
            state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                if (p.id === action.payload.projectId) {
                    p.tasks.push(action.payload);
                }
                return p;
            });
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? { ...p, tasks: p.tasks.concat(action.payload) } : p
                    )
                } : w
            );
        },
        updateTask: (state, action) => {
            state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                if (p.id === action.payload.projectId) {
                    p.tasks = p.tasks.map((t) =>
                        t.id === action.payload.id ? action.payload : t
                    );
                }
                return p;
            });
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.map((t) =>
                                t.id === action.payload.id ? action.payload : t
                            )
                        } : p
                    )
                } : w
            );
        },
        deleteTask: (state, action) => {
            state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                p.tasks = p.tasks.filter((t) => !action.payload.includes(t.id));
                return p;
            });
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) => ({
                        ...p, tasks: p.tasks.filter((t) => !action.payload.includes(t.id))
                    }))
                } : w
            );
        }
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
                const localStorageCurrentWorkspaceId = localStorage.getItem("currentWorkspaceId");
                if (localStorageCurrentWorkspaceId) {
                    const findWorkspace = action.payload.find((w) => w.id === localStorageCurrentWorkspaceId);
                    state.currentWorkspace = findWorkspace || action.payload[0];
                } else {
                    state.currentWorkspace = action.payload[0];
                }
            }
        });
        builder.addCase(fetchWorkspaces.rejected, (state) => {
            state.hasFetched = true;
            state.loading = false;
        });
    }
});

export const { setWorkspaces, setCurrentWorkspace, addWorkspace, updateWorkspace, deleteWorkspace, addProject, addTask, updateTask, deleteTask } = workspaceSlice.actions;
export default workspaceSlice.reducer;