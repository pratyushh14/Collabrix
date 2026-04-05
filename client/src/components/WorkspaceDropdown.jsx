import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace } from "../features/workspaceSlice";
import { useClerk, useOrganizationList } from "@clerk/react";
import { fetchWorkspaces } from "../features/workspaceSlice";
import { useAuth } from "@clerk/react";

function WorkspaceDropdown() {
    const { getToken } = useAuth();
    const { setActive, userMemberships, isLoaded } =
        useOrganizationList({ userMemberships: true });

    const { openCreateOrganization } = useClerk();

    const { workspaces, currentWorkspace } = useSelector(
        (state) => state.workspace
    );

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const dispatch = useDispatch();

    // ✅ FIXED: no navigation, no reload
    const onSelectWorkspace = async (organizationId) => {
    try {
        await setActive({ organization: organizationId });

        // ✅ FIX: set immediately
        dispatch(setCurrentWorkspace(organizationId));

        // ✅ then sync from backend
        dispatch(fetchWorkspaces({ getToken }));

        localStorage.setItem("currentWorkspaceId", organizationId);

        setIsOpen(false);
    } catch (err) {
        console.error("Switch error:", err);
    }
};

    // ✅ outside click handler
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ✅ FIXED: only set once when loaded (NO LOOP)
    useEffect(() => {
        if (!isLoaded) return;

        const savedId = localStorage.getItem("currentWorkspaceId");

        if (savedId) {
            setActive({ organization: savedId }).catch((error) => {
                console.warn("Could not set active organization from storage:", error);
                localStorage.removeItem("currentWorkspaceId");
            });
        }
    }, [isLoaded, setActive]);

    return (
        <div className="relative m-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-3 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <div className="flex items-center gap-3">
                    <img
                        src={currentWorkspace?.image_url}
                        alt={currentWorkspace?.name}
                        className="w-8 h-8 rounded shadow"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">
                            {currentWorkspace?.name || "Select Workspace"}
                        </p>
                        <p className="text-xs text-gray-500">
                            {workspaces.length} workspace
                            {workspaces.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-64 bg-white dark:bg-zinc-900 border rounded shadow-lg top-full left-0">
                    <div className="p-2">
                        <p className="text-xs text-gray-500 uppercase mb-2 px-2">
                            Workspaces
                        </p>

                        {isLoaded &&
                            userMemberships?.data?.map((membership) => (
                                <div
                                    key={membership.organization.id}
                                    onClick={() =>
                                        onSelectWorkspace(
                                            membership.organization.id
                                        )
                                    }
                                    className="flex items-center gap-3 p-2 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                                >
                                    <img
                                        src={
                                            membership.organization.imageUrl
                                        }
                                        alt={
                                            membership.organization.name
                                        }
                                        className="w-6 h-6 rounded"
                                    />

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {
                                                membership.organization
                                                    .name
                                            }
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {
                                                membership.organization
                                                    .membersCount
                                            }{" "}
                                            members
                                        </p>
                                    </div>

                                    {currentWorkspace?.id ===
                                        membership.organization.id && (
                                        <Check className="w-4 h-4 text-blue-500" />
                                    )}
                                </div>
                            ))}
                    </div>

                    <hr />

                    <div
                        onClick={() => {
                            openCreateOrganization();
                            setIsOpen(false);
                        }}
                        className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <p className="flex items-center gap-2 text-blue-500 text-sm">
                            <Plus className="w-4 h-4" /> Create Workspace
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceDropdown;