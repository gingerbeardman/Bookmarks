class BookmarksDataProvider {
    static bookmarks = [];
    static sortMode = 'none'; // 'none', 'alphabetical', 'recent'

    constructor() {}
    
    // Helper function to normalize relative paths by removing leading slashes
    static normalizeRelativePath(path) {
        if (!path) return path;
        // Remove leading slashes to ensure consistent relative paths
        return path.replace(/^\/+/, '');
    }
    
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
        
        // Handle both absolute and relative paths for backward compatibility
        const workspacePath = nova.workspace.path;
        let absolutePath = path;
        let relativePath = path;
        
        if (workspacePath) {
            if (path.startsWith(workspacePath)) {
                // It's an absolute path, convert to relative
                relativePath = path.substring(workspacePath.length);
                absolutePath = path;
            } else {
                // It's a relative path, convert to absolute
                absolutePath = nova.path.join(workspacePath, path);
                relativePath = path;
            }
        }
        
        // Normalize the relative path to ensure consistency
        relativePath = BookmarksDataProvider.normalizeRelativePath(relativePath);
        
        let name = nova.path.basename(relativePath);
        let item = new TreeItem(name, TreeItemCollapsibleState.None);
        item.path = relativePath; // Store relative path for consistency
        item.contextValue = "bookmark";
        item.tooltip = relativePath; // Show relative path on hover
        
        // Check if file/folder exists and grey out if missing
        let fileExists = false;
        try {
            fileExists = nova.fs.access(absolutePath, nova.fs.F_OK);
        } catch (error) {
            fileExists = false;
        }
        
        if (!fileExists) {
            console.log("File does not exist, applying missing file styling:", absolutePath);
            item.color = Color.secondaryLabel;
            item.tooltip = relativePath + " (file missing)";
            // Also make the item appear disabled
            item.descriptiveText = "file missing";
            // Add warning icon for missing files  
            item.image = "__symbol.reference";
        } else {
            console.log("File exists:", absolutePath);
        }
        
        // Add folder icon for directories (only if file exists)
        if (fileExists) {
            try {
                let stat = nova.fs.stat(absolutePath);
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
        
        // Convert absolute path to relative path from workspace root
        const workspacePath = nova.workspace.path;
        let relativePath = path;
        if (workspacePath && path.startsWith(workspacePath)) {
            relativePath = path.substring(workspacePath.length);
        }
        
        // Normalize the relative path to remove any leading slashes
        relativePath = this.normalizeRelativePath(relativePath);
        
        console.log("Converted to relative path:", relativePath);
        
        if (!this.bookmarks.includes(relativePath)) {
            this.bookmarks.push(relativePath);
            this.saveBookmarks();
            console.log("Bookmarks after adding:", this.bookmarks);
        } else {
            console.log("Bookmark already exists:", relativePath);
        }
    }

    static removeBookmark(path) {
        console.log("Removing bookmark with path:", path);
        
        // Convert absolute path to relative path from workspace root
        const workspacePath = nova.workspace.path;
        let relativePath = path;
        if (workspacePath && path.startsWith(workspacePath)) {
            relativePath = path.substring(workspacePath.length);
        }
        
        // Normalize the relative path to remove any leading slashes
        relativePath = this.normalizeRelativePath(relativePath);
        
        console.log("Looking for relative path:", relativePath);
        
        const index = this.bookmarks.indexOf(relativePath);
        if (index > -1) {
            this.bookmarks.splice(index, 1);
            this.saveBookmarks();
            console.log("Bookmark removed and saved");
        } else {
            console.log("No bookmark found with path:", relativePath);
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
            
            // Migrate absolute paths to relative paths and normalize all paths
            this.migrateBookmarksToRelativePaths();
        } else {
            console.log("No saved bookmarks found");
        }
    }
    
    static migrateBookmarksToRelativePaths() {
        const workspacePath = nova.workspace.path;
        if (!workspacePath) {
            console.log("No workspace path available for migration");
            return;
        }
        
        let migrationNeeded = false;
        const migratedBookmarks = this.bookmarks.map(bookmark => {
            let normalizedBookmark = bookmark;
            if (bookmark.startsWith(workspacePath)) {
                // Convert absolute path to relative
                normalizedBookmark = bookmark.substring(workspacePath.length);
                console.log("Migrating bookmark:", bookmark, "->", normalizedBookmark);
                migrationNeeded = true;
            }
            // Always normalize to remove leading slashes
            const finalPath = this.normalizeRelativePath(normalizedBookmark);
            if (finalPath !== bookmark) {
                migrationNeeded = true;
                console.log("Normalizing bookmark:", bookmark, "->", finalPath);
            }
            return finalPath;
        });
        
        if (migrationNeeded) {
            console.log("Migration completed, saving updated bookmarks");
            this.bookmarks = migratedBookmarks;
            this.saveBookmarks();
        }
    }

    static async triggerPathBasedSearch(targetPath) {
        console.log("Triggering path-based Files Sidebar search for:", targetPath);
        
        // Normalize the target path to remove leading slashes
        const normalizedPath = this.normalizeRelativePath(targetPath);
        console.log("Normalized path:", normalizedPath);
        
        // Parse path into segments
        const segments = normalizedPath.trim().split('/').filter(segment => segment.trim() !== '');
        if (segments.length === 0) {
            console.error("No valid path segments found");
            return;
        }
        
        console.log("Path segments:", segments);
        
        // Use the improved AppleScript
        const appleScript = `
            -- Parse path into segments, removing empty parts
            on parsePathSegments(pathString)
                set pathString to my trimString(pathString)
                if pathString = "" then return {}
                
                set segments to my splitString(pathString, "/")
                set cleanSegments to {}
                
                repeat with segment in segments
                    set cleanSegment to my trimString(segment as text)
                    if cleanSegment is not "" then
                        set end of cleanSegments to cleanSegment
                    end if
                end repeat
                
                return cleanSegments
            end parsePathSegments

            -- Find the Files outline in Nova's UI
            on findFilesOutline()
                tell application "System Events"
                    tell process "Nova"
                        try
                            set mainWindow to window 1
                            set splitGroup to (first UI element of mainWindow whose value of attribute "AXRole" is "AXSplitGroup")
                            set filesGroup to UI element 1 of splitGroup
                            
                            -- Search through all contents to find the outline
                            set allContents to entire contents of filesGroup
                            repeat with contentItem in allContents
                                try
                                    set itemRole to value of attribute "AXRole" of contentItem
                                    if itemRole is "AXOutline" then
                                        return contentItem
                                    end if
                                on error
                                    -- Continue searching
                                end try
                            end repeat
                            
                            return missing value
                        on error
                            return missing value
                        end try
                    end tell
                end tell
            end findFilesOutline

            -- Find a row with the given name, starting from a specific row and level
            on findRowWithName(allRows, targetName, startRowIndex, targetLevel)
                repeat with rowIndex from startRowIndex to (count of allRows)
                    set currentRow to item rowIndex of allRows
                    
                    -- Get the disclosure level of this row
                    set rowLevel to my getRowLevel(currentRow)
                    
                    -- If we've gone past our target level, stop searching
                    if rowLevel < targetLevel then
                        return missing value
                    end if
                    
                    -- Only check rows at our target level
                    if rowLevel = targetLevel then
                        set rowName to my extractRowTitle(currentRow)
                        
                        -- Case-insensitive comparison
                        if my compareStringsIgnoreCase(rowName, targetName) then
                            return {rowIndex, rowLevel}
                        end if
                    end if
                end repeat
                
                return missing value
            end findRowWithName

            -- Extract the title from a row using the cell structure
            on extractRowTitle(aRow)
                using terms from application "System Events"
                    try
                        -- Get the first cell of the row
                        set firstCell to UI element 1 of aRow
                        set cellElements to UI elements of firstCell
                    
                    -- Look for text elements within the cell
                    repeat with cellElement in cellElements
                        try
                            set elementRole to value of attribute "AXRole" of cellElement
                            if elementRole is "AXTextField" or elementRole is "AXStaticText" then
                                set elementValue to value of cellElement
                                if elementValue is not missing value and elementValue is not "" then
                                    return elementValue as text
                                end if
                            end if
                        on error
                            -- Continue to next element
                        end try
                    end repeat
                    
                    -- Fallback methods
                    try
                        return (value of attribute "AXTitle" of aRow) as text
                    on error
                        try
                            return (value of static text 1 of aRow) as text
                        on error
                            return ""
                        end try
                    end try
                    on error
                        return ""
                    end try
                end using terms from
            end extractRowTitle

            -- Get the disclosure level of a row
            on getRowLevel(aRow)
                using terms from application "System Events"
                    try
                        return value of attribute "AXDisclosureLevel" of aRow
                    on error
                        return 0
                    end try
                end using terms from
            end getRowLevel

            -- Expand a row (folder) by clicking and using right arrow
            on expandRow(aRow)
                using terms from application "System Events"
                    try
                        -- First ensure the row is selected and focused
                        click aRow
                        delay 0.1
                        
                        -- Set focus to the row to ensure keyboard input works
                        try
                            set focused of aRow to true
                        on error
                            -- Focus might not be settable, continue anyway
                        end try
                        
                        -- Check if it's already expanded
                        try
                            set isExpanded to value of attribute "AXDisclosed" of aRow
                            if isExpanded is true then
                                return -- Already expanded
                            end if
                        on error
                            -- Can't check expansion state, proceed anyway
                        end try
                        
                        -- Try clicking the disclosure triangle first, then fallback to right arrow
                        try
                            -- Look for disclosure triangle in the row
                            set firstCell to UI element 1 of aRow
                            set cellElements to UI elements of firstCell
                            repeat with cellElement in cellElements
                                try
                                    set elementRole to value of attribute "AXRole" of cellElement
                                    if elementRole is "AXDisclosureTriangle" then
                                        set triangleValue to value of cellElement
                                        -- Only click if triangle is closed (value = 0)
                                        if triangleValue = 0 then
                                            click cellElement
                                            return -- Successfully clicked disclosure triangle
                                        else
                                            return -- Already expanded, no need to do anything
                                        end if
                                    end if
                                end try
                            end repeat
                            -- No disclosure triangle found, use right arrow
                            tell application "System Events" to key code 124
                        on error
                            -- Fallback to right arrow
                            tell application "System Events" to key code 124
                        end try
                        
                    on error
                        -- Fallback: click and try right arrow
                        click aRow
                        tell application "System Events" to key code 124
                    end try
                end using terms from
            end expandRow

            -- Case-insensitive string comparison
            on compareStringsIgnoreCase(str1, str2)
                try
                    set str1Lower to do shell script "echo " & quoted form of str1 & " | tr '[:upper:]' '[:lower:]'"
                    set str2Lower to do shell script "echo " & quoted form of str2 & " | tr '[:upper:]' '[:lower:]'"
                    return str1Lower = str2Lower
                on error
                    -- Fallback to direct comparison
                    return str1 = str2
                end try
            end compareStringsIgnoreCase

            -- Split string by delimiter
            on splitString(theString, theDelimiter)
                set oldDelimiters to AppleScript's text item delimiters
                set AppleScript's text item delimiters to theDelimiter
                set theArray to text items of theString
                set AppleScript's text item delimiters to oldDelimiters
                return theArray
            end splitString

            -- Trim whitespace from string
            on trimString(theString)
                set theString to theString as text
                
                -- Trim leading whitespace
                repeat while theString begins with " " or theString begins with tab
                    if length of theString ≤ 1 then
                        return ""
                    end if
                    set theString to text 2 thru -1 of theString
                end repeat
                
                -- Trim trailing whitespace
                repeat while theString ends with " " or theString ends with tab
                    if length of theString ≤ 1 then
                        return ""
                    end if
                    set theString to text 1 thru -2 of theString
                end repeat
                
                return theString
            end trimString

            -- Main execution
            set targetPath to "${normalizedPath}"
            set segments to my parsePathSegments(targetPath)
            if (count of segments) = 0 then return "ERROR: No valid path segments found"
            
            tell application "System Events"
                if not (exists process "Nova") then return "ERROR: Nova is not running"
                tell process "Nova"
                    set frontmost to true
                    --delay 0.1
                    
                    -- Show Files sidebar using menu item
                    try
                        tell application "Nova"
                            activate
                            tell application "System Events"
                                tell process "Nova"
                                    click menu item "Files" of menu "Sidebar" of menu bar 1
                                end tell
                            end tell
                        end tell
                        --delay 0.1
                    on error
                        -- Fallback: try View menu
                        try
                            tell application "Nova"
                                activate
                                tell application "System Events"
                                    tell process "Nova"
                                        click menu item "Files" of menu "View" of menu bar 1
                                    end tell
                                end tell
                            end tell
                            --delay 0.1
                        on error
                            -- Last resort fallback to keyboard shortcut
                            keystroke "f" using {control down, shift down}
                            --delay 0.1
                        end try
                    end try
                    
                    -- Find the Files outline
                    set filesOutline to my findFilesOutline()
                    if filesOutline is missing value then return "ERROR: Could not locate Files outline"
                    
                    -- Get all rows
                    set allRows to rows of filesOutline
                    if (count of allRows) = 0 then return "ERROR: No files found in sidebar"
                    
                    -- Navigate through each path segment
                    set currentLevel to 0
                    set searchStartRow to 1
                    
                    repeat with segmentIndex from 1 to (count of segments)
                        set currentSegment to item segmentIndex of segments
                        set foundRowInfo to my findRowWithName(allRows, currentSegment, searchStartRow, currentLevel)
                        
                        if foundRowInfo is missing value then
                            return "ERROR: Could not find '" & currentSegment & "' in Files sidebar"
                        end if
                        
                        set foundRowIndex to item 1 of foundRowInfo
                        set foundRow to item foundRowIndex of allRows
                        
                        -- Click the row to select it
                        click foundRow
                        --delay 0.1
                        
                        -- If this is the last segment, ensure it gets focused and we're done
                        if segmentIndex = (count of segments) then
                            -- Ensure the outline view has focus and set final selection
                            try
                                set focused of filesOutline to true
                                set value of attribute "AXSelected" of foundRow to true
                                set focused of foundRow to true
                            on error
                                -- Continue anyway if any of these fail
                            end try
                            return "SUCCESS: Found and selected '" & currentSegment & "'"
                        end if
                        
                        -- Expand the folder for next level search
                        my expandRow(foundRow)
                        delay 0.1
                        
                        -- Update search parameters for next segment
                        set currentLevel to currentLevel + 1
                        set searchStartRow to foundRowIndex + 1
                        
                        -- Refresh the rows list after expansion
                        set allRows to rows of filesOutline
                    end repeat
                    
                    return "ERROR: Unexpected end of navigation"
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
        
        process.onDidExit((status) => {
            console.log("AppleScript process exited with status:", status);
            
            if (output.trim()) {
                console.log("AppleScript output:", output.trim());
            }
            if (errorOutput.trim()) {
                console.error("AppleScript errors:", errorOutput.trim());
            }
            
            if (status === 0 && (output.includes("SUCCESS") || output.trim() === "")) {
                // Exit status 0 means success, even if no explicit SUCCESS message
                console.log("Successfully navigated to:", normalizedPath);
            } else if (output.includes("SUCCESS")) {
                console.log("Successfully navigated to:", normalizedPath);
            } else if (output.includes("ERROR")) {
                console.error("Failed to navigate to:", normalizedPath);
                console.log("AppleScript error:", output.trim());
                nova.workspace.showErrorMessage("Path navigation failed: " + output.trim());
            } else {
                // Assume success if no explicit error and exit status is 0
                if (status === 0) {
                    console.log("Navigation completed (assuming success):", normalizedPath);
                } else {
                    console.error("Failed to navigate to:", normalizedPath);
                    console.log("AppleScript result:", output.trim());
                }
            }
        });
        
        try {
            await process.start();
        } catch (error) {
            console.error("Error executing path-based search:", error);
            nova.workspace.showErrorMessage("Failed to navigate to path: " + error.message);
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
            
            // Handle both absolute and relative paths for backward compatibility
            const workspacePath = nova.workspace.path;
            let absolutePath = path;
            let relativePath = path;
            
            if (workspacePath) {
                if (path.startsWith(workspacePath)) {
                    // It's an absolute path, convert to relative
                    relativePath = path.substring(workspacePath.length);
                    absolutePath = path;
                } else {
                    // It's a relative path, convert to absolute
                    absolutePath = nova.path.join(workspacePath, path);
                    relativePath = path;
                }
            }
            
            // Normalize the relative path to ensure consistency
            relativePath = BookmarksDataProvider.normalizeRelativePath(relativePath);
            
            // Check if file/folder exists before trying to open
            try {
                if (!nova.fs.access(absolutePath, nova.fs.F_OK)) {
                    return;
                }
                
                // Check if it's a directory and handle accordingly
                let stat = nova.fs.stat(absolutePath);
                if (stat && stat.isDirectory()) {
                    console.log("Triggering path-based Files Sidebar search for folder:", relativePath);
                    // Use path-based search for folder navigation (already relative)
                    BookmarksDataProvider.triggerPathBasedSearch(relativePath);
                } else {
                    // It's a file, open it normally
                    console.log("Opening file:", absolutePath);
                    nova.workspace.openFile(absolutePath);
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
            }
        } else {
            console.log("No active text editor");
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
            
            // Handle both absolute and relative paths for backward compatibility
            const workspacePath = nova.workspace.path;
            let absolutePath = path;
            let relativePath = path;
            
            if (workspacePath) {
                if (path.startsWith(workspacePath)) {
                    // It's an absolute path, convert to relative
                    relativePath = path.substring(workspacePath.length);
                    absolutePath = path;
                } else {
                    // It's a relative path, convert to absolute
                    absolutePath = nova.path.join(workspacePath, path);
                    relativePath = path;
                }
            }
            
            // Normalize the relative path to ensure consistency
            relativePath = BookmarksDataProvider.normalizeRelativePath(relativePath);
            
            try {
                if (!nova.fs.access(absolutePath, nova.fs.F_OK)) {
                    return;
                }
                
                // Check if it's a directory and handle accordingly
                let stat = nova.fs.stat(absolutePath);
                if (stat && stat.isDirectory()) {
                    console.log("Triggering path-based Files Sidebar search for folder:", relativePath);
                    // Use path-based search for folder navigation (already relative)
                    BookmarksDataProvider.triggerPathBasedSearch(relativePath);
                } else {
                    // It's a file, open it normally
                    console.log("Opening file:", absolutePath);
                    nova.workspace.openFile(absolutePath);
                }
            } catch (error) {
                console.error("Error opening bookmark:", error);
                nova.workspace.showErrorMessage("Failed to open: " + error.message);
            }
        } else {
            console.log("No item selected to open");
        }
    });

    nova.commands.register("com.gingerbeardman.Bookmark.showInFinder", (workspace) => {
        console.log("Show in Finder command triggered");
        let selectedItems = bookmarksView.selection;
        if (selectedItems && selectedItems.length > 0) {
            let path = selectedItems[0];
            console.log("Attempting to Show in Finder:", path);
            
            // Handle both absolute and relative paths for backward compatibility
            const workspacePath = nova.workspace.path;
            let absolutePath = path;
            let relativePath = path;
            
            if (workspacePath) {
                if (path.startsWith(workspacePath)) {
                    // It's an absolute path, convert to relative
                    relativePath = path.substring(workspacePath.length);
                    absolutePath = path;
                } else {
                    // It's a relative path, convert to absolute
                    absolutePath = nova.path.join(workspacePath, path);
                    relativePath = path;
                }
            }
            
            // Normalize the relative path to ensure consistency
            relativePath = BookmarksDataProvider.normalizeRelativePath(relativePath);
            
            try {
                // Check if the path exists
                if (nova.fs.access(absolutePath, nova.fs.F_OK)) {
                    // Use the 'open' command to Show in Finder
                    let process = new Process("/usr/bin/open", {
                        args: ["-R", absolutePath]
                    });
                    
                    process.onDidExit((status) => {
                        if (status === 0) {
                            console.log("Successfully Showed in Finder:", absolutePath);
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
            }
        } else {
            console.log("No item selected to Show in Finder");
        }
    });

    // Clean up missing bookmarks command
    nova.commands.register("com.gingerbeardman.Bookmark.cleanupMissing", (workspace) => {
        console.log("Clean up missing bookmarks command triggered");
        let removedCount = 0;
        let bookmarksToKeep = [];
        
        const workspacePath = nova.workspace.path;
        
        BookmarksDataProvider.bookmarks.forEach(relativePath => {
            try {
                // Convert relative path to absolute path for file system check
                let absolutePath = relativePath;
                if (workspacePath) {
                    absolutePath = nova.path.join(workspacePath, relativePath);
                }
                
                if (nova.fs.access(absolutePath, nova.fs.F_OK)) {
                    bookmarksToKeep.push(relativePath);
                } else {
                    removedCount++;
                    console.log("Removing missing bookmark:", relativePath);
                }
            } catch (error) {
                removedCount++;
                console.log("Removing inaccessible bookmark:", relativePath);
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
        
        // Convert absolute paths to relative paths for comparison
        const relativeFolders = allFolders.map(folderPath => {
            if (folderPath.startsWith(workspacePath)) {
                let relativePath = folderPath.substring(workspacePath.length);
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1);
                }
                return relativePath || '.'; // Return '.' for workspace root
            }
            return nova.path.basename(folderPath);
        });
        
        // Filter out folders that are already bookmarked (comparing relative paths)
        const unbookmarkedFolders = [];
        const unbookmarkedRelativePaths = [];
        
        for (let i = 0; i < allFolders.length; i++) {
            const relativePath = relativeFolders[i];
            if (!BookmarksDataProvider.bookmarks.includes(relativePath)) {
                unbookmarkedFolders.push(allFolders[i]);
                unbookmarkedRelativePaths.push(relativePath);
            }
        }
        
        console.log("Unbookmarked relative paths:", unbookmarkedRelativePaths);
        
        if (unbookmarkedRelativePaths.length === 0) {
            nova.workspace.showInformativeMessage("No unbookmarked folders found in the current workspace.");
            return;
        }
        
        nova.workspace.showChoicePalette(unbookmarkedRelativePaths, {}, (choice, index) => {
            if (choice && index !== undefined) {
                const selectedRelativePath = unbookmarkedRelativePaths[index];
                console.log("Adding folder bookmark:", selectedRelativePath);
                BookmarksDataProvider.addBookmark(nova.path.join(workspacePath, selectedRelativePath));
                bookmarksView.reload();
            }
        });
    });

    console.log("Bookmarks extension activated");
}