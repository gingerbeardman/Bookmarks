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

    static async triggerFilesSearch(folderPath) {
        console.log("Triggering Files Sidebar search for folder:", folderPath);
        
        const folderName = nova.path.basename(folderPath);
        console.log("Folder basename:", folderName);
        

        
        // Construct the AppleScript command: Direct hierarchical targeting
        const appleScript = `
            tell application "System Events"
                tell process "Nova"
                    set frontmost to true
                    delay 0.1
                    
                    -- Show Files Sidebar
                    keystroke "f" using {control down, shift down}
                    delay 0.1
                    
                    try
                        set splitGroup to (first UI element of window 1 whose value of attribute "AXRole" is "AXSplitGroup")
                        set filterField to missing value
                        
                        -- Method 1: Direct hierarchical targeting of Files sidebar (most reliable)
                        try
                            set filesGroup to UI element 1 of splitGroup
                            set groupRole to value of attribute "AXRole" of filesGroup
                            
                            if groupRole is "AXGroup" then
                                -- Search efficiently within the Files group
                                set groupContents to entire contents of filesGroup
                                
                                repeat with contentItem in groupContents
                                    try
                                        set itemRole to value of attribute "AXRole" of contentItem
                                        if itemRole is "AXTextField" then
                                            set tfSubrole to value of attribute "AXSubrole" of contentItem
                                            set tfPlaceholder to value of attribute "AXPlaceholderValue" of contentItem
                                            
                                            if tfSubrole is "AXSearchField" and tfPlaceholder is "Filter" then
                                                set filterField to contentItem
                                                exit repeat
                                            end if
                                        end if
                                    on error
                                        -- Continue searching
                                    end try
                                end repeat
                            end if
                        on error
                            -- Method 1 failed, continue to fallback
                        end try
                        
                        -- Fallback: Smart position-based search if hierarchical fails
                        if filterField is missing value then
                            set splitContents to entire contents of splitGroup
                            set contentCount to count of splitContents
                            
                            -- Target the known good range around position 60
                            set searchStart to 50
                            set searchEnd to 70
                            if searchEnd > contentCount then set searchEnd to contentCount
                            
                            repeat with j from searchStart to searchEnd
                                try
                                    set contentItem to item j of splitContents
                                    set itemRole to value of attribute "AXRole" of contentItem
                                    
                                    if itemRole is "AXTextField" then
                                        set tfSubrole to value of attribute "AXSubrole" of contentItem
                                        set tfPlaceholder to value of attribute "AXPlaceholderValue" of contentItem
                                        
                                        if tfSubrole is "AXSearchField" and tfPlaceholder is "Filter" then
                                            set filterField to contentItem
                                            exit repeat
                                        end if
                                    end if
                                on error
                                    -- Continue
                                end try
                            end repeat
                        end if
                        
                        if filterField is not missing value then
                            -- Interact with the Files sidebar filter field
                            set focused of filterField to true
                            click filterField
                            
                            -- Clear and type folder name
                            keystroke "a" using command down
                            key code 51  -- delete
                            keystroke "${folderName}"
                            key code 36  -- enter to apply filter
                            
                            -- Focus the file in filtered results and clear filter
                            delay 0.2  -- Wait for filter to apply
                            key code 48 using shift down  -- shift+tab
                            key code 125  -- down arrow
                            key code 48  -- tab
                            key code 48  -- tab
                            key code 53  -- escape to clear filter
                            
                            return "SUCCESS: File filter applied, focused, and cleared"
                        else
                            return "ERROR: Could not find filter field"
                        end if
                        
                    on error mainError
                        return "ERROR: " & (mainError as string)
                    end try
                end tell
            end tell
        `;
        
        // Execute the AppleScript command
        const process = new Process("/usr/bin/osascript", {
            args: ["-e", appleScript]
        });
        
        let output = "";
        let errorOutput = "";
        
        process.onStdout((line) => {
            output += line;
        });
        
        process.onStderr((line) => {
            errorOutput += line;
        });
        
        try {
            const result = await process.start();
            console.log("AppleScript execution completed with status:", result);
            if (output.trim()) {
                console.log("AppleScript output:", output.trim());
            }
            if (errorOutput.trim()) {
                console.error("AppleScript errors:", errorOutput.trim());
            }
            console.log("Files Sidebar search triggered successfully for:", folderName);
        } catch (error) {
            console.error("Error triggering Files Sidebar search:", error);
            if (errorOutput.trim()) {
                console.error("AppleScript stderr:", errorOutput.trim());
            }
            nova.workspace.showErrorMessage("Failed to trigger Files Sidebar search: " + error.message);
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
                    console.log("Triggering Files Sidebar search for folder:", path);
                    // Trigger Files Sidebar search for folder
                    BookmarksDataProvider.triggerFilesSearch(path);
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
                    console.log("Triggering Files Sidebar search for folder:", path);
                    // Trigger Files Sidebar search for folder
                    BookmarksDataProvider.triggerFilesSearch(path);
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
        
        // Filter out folders that are already bookmarked
        const unbookmarkedFolders = allFolders.filter(folderPath => 
            !BookmarksDataProvider.bookmarks.includes(folderPath)
        );
        console.log("Folders after filtering out bookmarked ones:", unbookmarkedFolders);
        
        if (unbookmarkedFolders.length === 0) {
            nova.workspace.showInformativeMessage("No unbookmarked folders found in the current workspace.");
            return;
        }
        
        // Create display names (relative paths from workspace root)
        const folderChoices = unbookmarkedFolders.map(folderPath => {
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
                const selectedFolderPath = unbookmarkedFolders[index];
                console.log("Adding folder bookmark:", selectedFolderPath);
                BookmarksDataProvider.addBookmark(selectedFolderPath);
                bookmarksView.reload();
            }
        });
    });

    console.log("Bookmarks extension activated");
}