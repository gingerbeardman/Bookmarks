class BookmarksDataProvider {
    static bookmarks = [];

    constructor() {}

    getChildren() {
        console.log("getChildren called, returning bookmarks:", BookmarksDataProvider.bookmarks);
        return BookmarksDataProvider.bookmarks;
    }

    getTreeItem(path) {
        console.log("getTreeItem called for path:", path);
        let name = nova.path.basename(path);
        let item = new TreeItem(name, TreeItemCollapsibleState.None);
        item.path = path;
        item.command = "com.gingerbeardman.Bookmark.open";
        item.contextValue = "bookmark";
        item.tooltip = path;
        console.log("Created TreeItem:", item);
        return item;
    }

    static addBookmark(path) {
        console.log("Adding bookmark for path:", path);
        if (!this.bookmarks.includes(path)) {
            this.bookmarks.push(path);
            this.saveBookmarks();
            console.log("Bookmarks after adding:", this.bookmarks);
        } else {
            console.log("Bookmark already exists:", path);
        }
    }

    static removeBookmark(path) {
        console.log("Removing bookmark with path:", path);
        const index = this.bookmarks.indexOf(path);
        if (index > -1) {
            this.bookmarks.splice(index, 1);
            this.saveBookmarks();
            console.log("Bookmark removed and saved");
        } else {
            console.log("No bookmark found with path:", path);
        }
        console.log("Bookmarks after removal:", this.bookmarks);
    }

    static saveBookmarks() {
        console.log("Saving bookmarks:", this.bookmarks);
        nova.workspace.config.set("com.gingerbeardman.Bookmark.bookmarks", JSON.stringify(this.bookmarks));
    }

    static loadBookmarks() {
        const savedBookmarks = nova.workspace.config.get("com.gingerbeardman.Bookmark.bookmarks");
        if (savedBookmarks) {
            this.bookmarks = JSON.parse(savedBookmarks);
            console.log("Loaded bookmarks:", this.bookmarks);
        } else {
            console.log("No saved bookmarks found");
        }
    }
}

// Load bookmarks when the extension is activated
BookmarksDataProvider.loadBookmarks();

exports.activate = function() {
    console.log("Activating Bookmarks extension");

    // Create a new TreeView for bookmarks
    let bookmarksView = new TreeView("com.gingerbeardman.Bookmark.sidebar", {
        dataProvider: new BookmarksDataProvider()
    });

    // Register commands
    nova.commands.register("com.gingerbeardman.Bookmark.add", (workspace) => {
        console.log("Add bookmark command triggered");
        let editor = nova.workspace.activeTextEditor;
        if (editor) {
            let path = editor.document.path;
            if (path) {
                try {
                    if (nova.fs.access(path, nova.fs.F_OK)) {
                        BookmarksDataProvider.addBookmark(path);
                        bookmarksView.reload();
                    } else {
                        console.error("File does not exist:", path);
                        nova.workspace.showErrorMessage("Cannot bookmark: File does not exist.");
                    }
                } catch (error) {
                    console.error("Error adding bookmark:", error);
                    nova.workspace.showErrorMessage("Failed to add bookmark: " + error.message);
                }
            } else {
                console.log("No path found for current document");
                // nova.workspace.showInformativeMessage("Cannot bookmark: No file is currently open.");
            }
        } else {
            console.log("No active text editor");
            // nova.workspace.showInformativeMessage("Cannot bookmark: No file is currently open.");
        }
    });

    nova.commands.register("com.gingerbeardman.Bookmark.remove", (workspace) => {
        console.log("Remove bookmark command triggered");
        let selectedItems = bookmarksView.selection;
        console.log("Selected items:", selectedItems);
        if (selectedItems && selectedItems.length > 0) {
            selectedItems.forEach(item => {
                console.log("Removing item with path:", item);
                BookmarksDataProvider.removeBookmark(item);
            });
            bookmarksView.reload();
        } else {
            console.log("No items selected for removal");
            // nova.workspace.showInformativeMessage("Please select a bookmark to remove.");
        }
    });

    nova.commands.register("com.gingerbeardman.Bookmark.removeByFilename", (workspace) => {
        console.log("Remove bookmark by filename command triggered");
        let editor = nova.workspace.activeTextEditor;
        if (editor) {
            let path = editor.document.path;
            if (path) {
                BookmarksDataProvider.removeBookmark(path);
                bookmarksView.reload();
            } else {
                console.log("No path found for current document");
                nova.workspace.showInformativeMessage("Cannot remove bookmark: No file is currently open.");
            }
        } else {
            console.log("No active text editor");
            nova.workspace.showInformativeMessage("Cannot remove bookmark: No file is currently open.");
        }
    });

    nova.commands.register("com.gingerbeardman.Bookmark.open", (workspace) => {
        console.log("Open bookmark command triggered");
        let selectedItems = bookmarksView.selection;
        if (selectedItems && selectedItems.length > 0) {
            let path = selectedItems[0];
            console.log("Opening file:", path);
            try {
                nova.workspace.openFile(path);
            } catch (error) {
                console.error("Error opening file:", error);
                nova.workspace.showErrorMessage("Failed to open file: " + error.message);
            }
        } else {
            console.log("No item selected to open");
            // nova.workspace.showInformativeMessage("Please select a bookmark to open.");
        }
    });

    nova.commands.register("com.gingerbeardman.Bookmark.showInFinder", (workspace) => {
        console.log("Show in Finder command triggered");
        let selectedItems = bookmarksView.selection;
        if (selectedItems && selectedItems.length > 0) {
            let path = selectedItems[0];
            console.log("Attempting to reveal in Finder:", path);
            try {
                // Check if the path exists
                if (nova.fs.access(path, nova.fs.F_OK)) {
                    // Use the 'open' command to reveal in Finder
                    let process = new Process("/usr/bin/open", {
                        args: ["-R", path]
                    });
                    
                    process.onDidExit((status) => {
                        if (status === 0) {
                            console.log("Successfully revealed in Finder:", path);
                        } else {
                            console.error("Failed to reveal in Finder. Exit status:", status);
                            nova.workspace.showErrorMessage("Failed to reveal in Finder. Please check the path.");
                        }
                    });
                    
                    process.start();
                } else {
                    throw new Error("Path does not exist");
                }
            } catch (error) {
                console.error("Error revealing in Finder:", error);
                nova.workspace.showErrorMessage("Failed to reveal in Finder: " + error.message);
            }
        } else {
            console.log("No item selected to show in Finder");
            // nova.workspace.showInformativeMessage("Please select a bookmark to reveal in Finder.");
        }
    });

    console.log("Bookmarks extension activated");
}