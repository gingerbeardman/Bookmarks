class BookmarksDataProvider {
    static bookmarks = [];
    static sortMode = 'none'; // 'none', 'alphabetical', 'recent'

    constructor() {}
    
    static loadDefaultSort() {
        const defaultSort = nova.config.get("com.gingerbeardman.Bookmarks.defaultSort", "string") || "none";
        this.sortMode = defaultSort;
        console.log("Loaded default sort mode:", this.sortMode);
    }

    getChildren() {
        console.log("getChildren called, returning bookmarks:", BookmarksDataProvider.bookmarks);
        let sortedBookmarks = [...BookmarksDataProvider.bookmarks];
        
        if (BookmarksDataProvider.sortMode === 'alphabetical') {
            sortedBookmarks.sort((a, b) => {
                let nameA = nova.path.basename(a).toLowerCase();
                let nameB = nova.path.basename(b).toLowerCase();
                return nameA.localeCompare(nameB);
            });
        } else if (BookmarksDataProvider.sortMode === 'recent') {
            // Most recently added first (reverse order)
            sortedBookmarks.reverse();
        }
        
        return sortedBookmarks;
    }

    getTreeItem(path) {
        console.log("getTreeItem called for path:", path);
        let name = nova.path.basename(path);
        let item = new TreeItem(name, TreeItemCollapsibleState.None);
        item.path = path;
        item.contextValue = "bookmark";
        item.tooltip = path; // Full path on hover
        
        // Check if file/folder exists and grey out if missing
        let fileExists = false;
        try {
            fileExists = nova.fs.access(path, nova.fs.F_OK);
        } catch (error) {
            fileExists = false;
        }
        
        if (!fileExists) {
            console.log("File does not exist, applying missing file styling:", path);
            item.color = Color.secondaryLabel;
            item.tooltip = path + " (file missing)";
            // Also make the item appear disabled
            item.descriptiveText = "file missing";
            // Add warning icon for missing files  
            item.image = "__symbol.reference";
        } else {
            console.log("File exists:", path);
        }
        
        // Add folder icon for directories (only if file exists)
        if (fileExists) {
            try {
                let stat = nova.fs.stat(path);
                if (stat && stat.isDirectory()) {
                    item.image = "__symbol.function";
                }
            } catch (error) {
                // Error getting file stats, but file exists - treat as file
            }
        }
        
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
BookmarksDataProvider.loadDefaultSort();

exports.activate = function() {
    console.log("Activating Bookmarks extension");

    // Create a new TreeView for bookmarks
    let bookmarksView = new TreeView("com.gingerbeardman.Bookmark.sidebar", {
        dataProvider: new BookmarksDataProvider()
    });

    // Add single-click open behavior
    bookmarksView.onDidChangeSelection((selectedItems) => {
        if (selectedItems && selectedItems.length > 0) {
            let path = selectedItems[0];
            console.log("Single-click selecting bookmark:", path);
            
            // Check if file/folder exists before trying to open
            try {
                if (!nova.fs.access(path, nova.fs.F_OK)) {
                    // nova.workspace.showErrorMessage("File does not exist.");
                    return;
                }
                
                // Check if it's a directory and handle accordingly
                let stat = nova.fs.stat(path);
                if (stat && stat.isDirectory()) {
                    console.log("Opening folder in Finder:", path);
                    // Open folder in Finder
                    let process = new Process("/usr/bin/open", {
                        args: [path]
                    });
                    process.start();
                } else {
                    // It's a file, open it normally
                    console.log("Opening file:", path);
                    nova.workspace.openFile(path);
                }
            } catch (error) {
                console.error("Error handling selection:", error);
                nova.workspace.showErrorMessage("Failed to open: " + error.message);
            }
        }
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
                        if (BookmarksDataProvider.bookmarks.includes(path)) {
                            // nova.workspace.showInformativeMessage("File is already bookmarked.");
                            return;
                        }
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
            console.log("Opening bookmark:", path);
            try {
                if (!nova.fs.access(path, nova.fs.F_OK)) {
                    // nova.workspace.showErrorMessage("File does not exist.");
                    return;
                }
                
                // Check if it's a directory and handle accordingly
                let stat = nova.fs.stat(path);
                if (stat && stat.isDirectory()) {
                    console.log("Opening folder in Finder:", path);
                    // Open folder in Finder
                    let process = new Process("/usr/bin/open", {
                        args: [path]
                    });
                    process.start();
                } else {
                    // It's a file, open it normally
                    console.log("Opening file:", path);
                    nova.workspace.openFile(path);
                }
            } catch (error) {
                console.error("Error opening bookmark:", error);
                nova.workspace.showErrorMessage("Failed to open: " + error.message);
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
            console.log("Attempting to Show in Finder:", path);
            try {
                // Check if the path exists
                if (nova.fs.access(path, nova.fs.F_OK)) {
                    // Use the 'open' command to Show in Finder
                    let process = new Process("/usr/bin/open", {
                        args: ["-R", path]
                    });
                    
                    process.onDidExit((status) => {
                        if (status === 0) {
                            console.log("Successfully Showed in Finder:", path);
                        } else {
                            console.error("Failed to Show in Finder. Exit status:", status);
                            nova.workspace.showErrorMessage("Failed to Show in Finder. Please check the path.");
                        }
                    });
                    
                    process.start();
                } else {
                    throw new Error("Path does not exist");
                }
            } catch (error) {
                console.error("Error Showing in Finder:", error);
                // nova.workspace.showErrorMessage("Failed to Show in Finder: " + error.message);
            }
        } else {
            console.log("No item selected to Show in Finder");
            // nova.workspace.showInformativeMessage("Please select a bookmark to Show in Finder.");
        }
    });

    // Clean up missing bookmarks command
    nova.commands.register("com.gingerbeardman.Bookmark.cleanupMissing", (workspace) => {
        console.log("Clean up missing bookmarks command triggered");
        let removedCount = 0;
        let bookmarksToKeep = [];
        
        BookmarksDataProvider.bookmarks.forEach(path => {
            try {
                if (nova.fs.access(path, nova.fs.F_OK)) {
                    bookmarksToKeep.push(path);
                } else {
                    removedCount++;
                    console.log("Removing missing bookmark:", path);
                }
            } catch (error) {
                removedCount++;
                console.log("Removing inaccessible bookmark:", path);
            }
        });
        
        BookmarksDataProvider.bookmarks = bookmarksToKeep;
        BookmarksDataProvider.saveBookmarks();
        bookmarksView.reload();
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} missing bookmark${removedCount === 1 ? '' : 's'}.`);
        } else {
            console.log("No missing bookmarks found.");
        }
    });

    // Sort bookmarks command
    nova.commands.register("com.gingerbeardman.Bookmark.sort", (workspace) => {
        console.log("Sort bookmarks command triggered");
        
        const defaultSort = nova.config.get("com.gingerbeardman.Bookmarks.defaultSort", "string") || "none";
        let options = ["None", "Alphabetical", "Most Recent First"];
        let currentIndex = BookmarksDataProvider.sortMode === 'none' ? 0 : 
                          BookmarksDataProvider.sortMode === 'alphabetical' ? 1 : 2;
        
        // Add indicator for default setting
        options = options.map((option, index) => {
            const mode = index === 0 ? 'none' : index === 1 ? 'alphabetical' : 'recent';
            return mode === defaultSort ? `${option} (default)` : option;
        });
        
        nova.workspace.showChoicePalette(options, { selectedIndex: currentIndex }, (choice, index) => {
            if (choice) {
                switch (index) {
                    case 0:
                        BookmarksDataProvider.sortMode = 'none';
                        break;
                    case 1:
                        BookmarksDataProvider.sortMode = 'alphabetical';
                        break;
                    case 2:
                        BookmarksDataProvider.sortMode = 'recent';
                        break;
                }
                console.log("Sort mode changed to:", BookmarksDataProvider.sortMode);
                bookmarksView.reload();
            }
        });
    });

    

    // Helper function to get all folders in project
    function getAllFolders(dir) {
        const fs = nova.fs;
        let results = [];
        
        try {
            const list = fs.listdir(dir);
            
            for (let item of list) {
                // Skip hidden files and common ignore patterns
                if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
                    continue;
                }
                
                const fullPath = nova.path.join(dir, item);
                const stat = fs.stat(fullPath);
                
                if (stat && stat.isDirectory()) {
                    results.push(fullPath);
                    // Recursively get subfolders
                    results = results.concat(getAllFolders(fullPath));
                }
            }
        } catch (error) {
            console.error("Error reading directory:", dir, error);
        }
        
        return results;
    }

    // Add folder bookmark command
    nova.commands.register("com.gingerbeardman.Bookmark.addFolder", (workspace) => {
        console.log("Add folder bookmark command triggered");
        
        const workspacePath = nova.workspace.path;
        if (!workspacePath) {
            nova.workspace.showErrorMessage("No workspace is currently open.");
            return;
        }
        
        // Get all folders in the workspace
        const allFolders = getAllFolders(workspacePath);
        console.log("Workspace path:", workspacePath);
        console.log("Found folders:", allFolders);
        
        if (allFolders.length === 0) {
            nova.workspace.showInformativeMessage("No folders found in the current workspace.");
            return;
        }
        
        // Create display names (relative paths from workspace root)
        const folderChoices = allFolders.map(folderPath => {
            // Simple approach: remove workspace path prefix
            if (folderPath.startsWith(workspacePath)) {
                let relativePath = folderPath.substring(workspacePath.length);
                // Remove leading slash if present
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1);
                }
                console.log("Folder path:", folderPath, "-> Relative:", relativePath);
                return relativePath || '.'; // Return '.' for workspace root
            }
            // Fallback to just the folder name if path manipulation fails
            const baseName = nova.path.basename(folderPath);
            console.log("Fallback for:", folderPath, "-> Basename:", baseName);
            return baseName;
        });
        
        nova.workspace.showChoicePalette(folderChoices, {}, (choice, index) => {
            if (choice && index !== undefined) {
                const selectedFolderPath = allFolders[index];
                console.log("Adding folder bookmark:", selectedFolderPath);
                BookmarksDataProvider.addBookmark(selectedFolderPath);
                bookmarksView.reload();
            }
        });
    });

    console.log("Bookmarks extension activated");
}