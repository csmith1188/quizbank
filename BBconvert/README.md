# Blackboard Quiz Conversion Scripts

This directory contains scripts to convert quiz data from the quizbank to Blackboard-compatible format.

## Scripts Overview

### 1. `convert_to_blackboard_enhanced.js` - Individual Task Export
Exports questions from a specific task to a Blackboard quiz file.

**Usage:**
```bash
node convert_to_blackboard_enhanced.js <sectionId> <unitId> <taskId>
```

**Example:**
```bash
node convert_to_blackboard_enhanced.js 2 1 1
```

### 2. `convert_unit_to_blackboard.js` - Complete Unit Export
Exports ALL questions from ALL tasks in a unit to a single Blackboard quiz file.

**Usage:**
```bash
node convert_unit_to_blackboard.js <sectionId> <unitId>
```

**Example:**
```bash
node convert_unit_to_blackboard.js 2 1
```

## Available Content

To see what sections, units, and tasks are available, run either script without arguments:

```bash
node convert_to_blackboard_enhanced.js
# or
node convert_unit_to_blackboard.js
```

## Output Files

Both scripts now automatically create:

1. **`blackboard_[Section]_[Unit]_[Task].zip`** - Individual task ZIP file (for enhanced script)
2. **`blackboard_unit_[Section]_[Unit].zip`** - Complete unit ZIP file (for unit script)

Each ZIP file contains:
- `blackboard_quiz.dat` - The main quiz data file
- `imsmanifest.xml` - The manifest file required by Blackboard

## Automatic ZIP Creation

Both scripts now use the `archiver` package to automatically create properly formatted ZIP files that are ready for Blackboard import. No manual ZIP creation is required!

## Alternative ZIP Creation Methods

If you prefer manual control or encounter issues with the automatic ZIP creation, you can still use:

### Option 1: Using the Batch Script (Windows)
1. Navigate to the `exports` folder
2. Run `create_blackboard_zip.bat`
3. This will create `blackboard_import.zip` automatically

### Option 2: Manual ZIP Creation
1. Select both files: `blackboard_quiz.dat` and `imsmanifest.xml`
2. Right-click and choose "Send to > Compressed (zipped) folder"
3. Rename the ZIP file to something descriptive
4. The ZIP file should contain both files at the root level (not in subfolders)

### Option 3: Using PowerShell
```powershell
Compress-Archive -Path "blackboard_quiz.dat","imsmanifest.xml" -DestinationPath "blackboard_import.zip"
```

## Blackboard Import Process

1. **Run the conversion script** - ZIP files are created automatically
2. **Upload to Blackboard:**
   - Go to your Blackboard course
   - Navigate to Course Tools > Tests, Surveys, and Pools
   - Click "Import Pool"
   - Upload your ZIP file
   - Follow the import wizard

## File Structure Requirements

For Blackboard to accept the import, the ZIP file must contain:
- `blackboard_quiz.dat` (at root level)
- `imsmanifest.xml` (at root level)

**Important:** Do not put these files in subfolders within the ZIP.

## Troubleshooting

### "Invalid Blackboard export file" Error
- Ensure the ZIP file contains exactly the two required files
- Verify both files are at the root level of the ZIP (not in subfolders)
- Check that the file names are exactly: `blackboard_quiz.dat` and `imsmanifest.xml`

### Missing Files
- Run the conversion script first to generate the required files
- Check that you're in the correct directory
- Ensure the `exports` folder exists

### ZIP Creation Issues
If automatic ZIP creation fails:
- Check that the `archiver` package is installed: `npm install archiver`
- Use the manual ZIP creation methods listed above
- Or run the batch script from the `exports` folder

## Example Workflow

### For Individual Tasks:
```bash
node convert_to_blackboard_enhanced.js 2 1 1
# ZIP file is created automatically: blackboard_Python_Basics_Variables_and_Data_Types_Documetation.zip
```

### For Complete Units:
```bash
node convert_unit_to_blackboard.js 2 1
# ZIP file is created automatically: blackboard_unit_Python_Basics_Variables_and_Data_Types.zip
```

## File Naming Convention

- **Individual tasks:** `blackboard_[Section]_[Unit]_[Task].zip`
- **Complete units:** `blackboard_unit_[Section]_[Unit].zip`

## Dependencies

- **Node.js** - Required to run the scripts
- **archiver** - Automatically installed when you run `npm install` in the BBconvert directory

## Support

If you encounter issues:
1. Check that all required files are present
2. Verify the ZIP file structure is correct
3. Ensure the ZIP contains only the two required files at the root level
4. Try recreating the ZIP file using a different method
5. Ensure the `archiver` package is installed: `npm install archiver`
