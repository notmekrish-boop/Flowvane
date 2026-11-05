// A project membership is valid only while the user remains in its workspace.
export function workspaceProjectAccess(userId) {
  return { workspace: { members: { some: { userId } } } };
}
