# Blackboard Test Conversion Script

This script converts quiz questions from the `10th.json` file to Blackboard test format.

## Features

- **ID-based Selection**: Uses section, unit, and task IDs instead of array indices
- **Exports Folder**: All generated files are saved to an `exports/` folder
- **Automatic Directory Creation**: Creates the exports folder if it doesn't exist
- **XML Escaping**: Properly escapes special characters for Blackboard compatibility
- **Question Validation**: Filters out invalid questions automatically

## Usage

### Show Available Tasks
```bash
node convert_to_blackboard_enhanced.js
```
This displays all available sections, units, and tasks with their IDs.

### Convert Specific Task
```bash
node convert_to_blackboard_enhanced.js <sectionId> <unitId> <taskId>
```

**Examples:**
```bash
# Convert the Documentation task
node convert_to_blackboard_enhanced.js 2 1 1

# Convert the Datatypes task
node convert_to_blackboard_enhanced.js 2 1 2

# Convert the Assignment task
node convert_to_blackboard_enhanced.js 2 1 3
```

## Available Tasks

### Section 2: Python Basics

#### Unit 1: Variables and Data Types
- Task 1: Documentation (12 questions)
- Task 2: Datatypes (20 questions)
- Task 3: Assignment (19 questions)
- Task 4: Expressions (17 questions)
- Task 8: Error Messages (12 questions)

#### Unit 2: Comparisons and Conditions
- Task 5: Comparisons and Conditions (25 questions)
- Task 6: Conditional Loops (7 questions)
- Task 7: Logical Operators (15 questions)

#### Unit 3: Functions
- Task 9: Debuggers (10 questions)
- Task 10: Procedures (6 questions)

#### Unit 4: Lists and Loops
- Task 11: Ordered Collections (4 questions)
- Task 12: Iterative Loops (5 questions)
- Task 13: Nested Collections (1 question)

## Output

The script creates an `exports/` folder containing:

1. **Main Test File** (`blackboard_[Section]_[Unit]_[Task].dat`)
   - Contains all questions in Blackboard XML format
   - Ready for import into Blackboard

2. **Manifest File** (`imsmanifest_[Section]_[Unit]_[Task].xml`)
   - Required for Blackboard import

## File Structure

```
BBconvert/
├── convert_to_blackboard_enhanced.js
├── exports/
│   ├── blackboard_Python_Basics_Variables_and_Data_Types_Documentation.dat
│   ├── imsmanifest_Python_Basics_Variables_and_Data_Types_Documentation.xml
│   ├── blackboard_Python_Basics_Variables_and_Data_Types_Datatypes.dat
│   └── imsmanifest_Python_Basics_Variables_and_Data_Types_Datatypes.xml
└── README.md
```

## Requirements

- Node.js installed
- Access to `../quizsources/10th.json` file
- File system write permissions

## Blackboard Import

1. Upload both files from the `exports/` folder to your Blackboard course
2. Use the "Import Package" feature
3. Select the manifest file (`.xml`)
4. Blackboard will import the test as a question pool

## Notes

- The script automatically creates the `exports/` folder if it doesn't exist
- All files are saved with descriptive names based on section, unit, and task names
- The script validates questions and skips invalid ones
- XML special characters are automatically escaped
