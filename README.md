# Quiz Bank API

A RESTful API for accessing quiz bank hierarchy data.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on port 3000 by default.

## Database

The application uses SQLite as the database, with Sequelize as the ORM (Object-Relational Mapping) tool. The database file is located at [`db/database.sqlite`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fdatabase.sqlite%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "c:\Users\robert.ambartsumyan\Documents\programs25-26\quizbank\db\database.sqlite"). Sequelize provides a simple way to define models and relationships, making it easy to interact with the database.

### Database Models

The database consists of the following models:

- **Course**: Represents a course, which contains multiple sections.
- **Section**: Represents a section within a course, which contains multiple units.
- **Unit**: Represents a unit within a section, which contains multiple tasks.
- **Task**: Represents a task within a unit, which contains multiple questions.
- **Question**: Represents a question within a task.

### Relationships

- A [`Course`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fcourses.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A33%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A13%2C%22character%22%3A27%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A210%2C%22character%22%3A15%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A25%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") has many [`Sections`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A35%2C%22character%22%3A9%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition").
- A [`Section`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fcourses.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A18%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A40%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") belongs to a [`Course`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fcourses.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A33%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A13%2C%22character%22%3A27%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A210%2C%22character%22%3A15%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A25%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") and has many [`Units`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A50%2C%22character%22%3A9%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition").
- A [`Unit`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Ftasks.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A17%2C%22character%22%3A31%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A24%2C%22character%22%3A29%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A55%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") belongs to a [`Section`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fcourses.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A18%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A40%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") and has many [`Tasks`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A75%2C%22character%22%3A9%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition").
- A [`Task`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A17%2C%22character%22%3A28%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Ftasks.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fquestions.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A15%2C%22character%22%3A34%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A30%2C%22character%22%3A31%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A80%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") belongs to a [`Unit`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Ftasks.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A11%2C%22character%22%3A30%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fsections.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A17%2C%22character%22%3A31%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A24%2C%22character%22%3A29%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A55%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") and has many [`Questions`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A30%2C%22character%22%3A16%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition").
- A [`Question`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Ftasks.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A17%2C%22character%22%3A28%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fquestions.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A36%2C%22character%22%3A20%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition") belongs to a [`Task`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Funits.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A17%2C%22character%22%3A28%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Ftasks.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A1%2C%22character%22%3A10%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fmodels%2Fquestions.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A15%2C%22character%22%3A34%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2Fdb%2Fseed.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A30%2C%22character%22%3A31%7D%7D%2C%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fc%3A%2FUsers%2Frobert.ambartsumyan%2FDocuments%2Fprograms25-26%2Fquizbank%2FREADME.md%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A80%2C%22character%22%3A8%7D%7D%5D%2C%22edce20ec-36e6-421f-9d61-9e4d06b8439e%22%5D "Go to definition").

## Seeding System

The seeding system is designed to populate the database with initial data for courses, sections, units, tasks, and questions. This allows for easier testing and development of the API.

### Seeding Process

1. **Define Seed Data**: The seed data is defined in a JSON file located at [`quizsources/courses.json`]. This file contains the hierarchy of courses, sections, units, tasks, and questions.

2. **Run Seeder**: Use the following command to seed the database:
   ```bash
   node db/seed.js
   ```

   This will:
   - Recreate the database tables.
   - Populate the database with the data from [`quizsources/courses.json`].

3. **Example Seed Data**: Below is an example structure of the [`courses.json`] file:
   ```json
   {
     "courses": [
       {
         "name": "Course 1",
         "sections": [
           {
             "name": "Section 1",
             "units": [
               {
                 "name": "Unit 1",
                 "tasks": [
                   {
                     "name": "Task 1",
                     "questions": [
                       {
                         "prompt": "What is 2 + 2?",
                         "correctAnswer": "4",
                         "correctIndex": 0,
                         "answers": ["4", "3", "5", "6"],
                         "ai": false
                       }
                     ]
                   }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }
   ```

4. **Output**: After running the seeder, you should see the following message:
   ```
   ✅ Database seeded successfully!
   ```

## API Endpoints

### Get Course Details
```
GET /course/:courseId
```

### Pick Random Questions from a Course
```
GET /course/:courseId/pick/:number
```

### List Sections in a Course
```
GET /course/:courseId/section
```

### Get Section Details
```
GET /course/:courseId/section/:sectionId
```

### Pick Random Questions from a Section
```
GET /course/:courseId/section/:sectionId/pick/:number
```

### List Units in a Section
```
GET /course/:courseId/section/:sectionId/unit
```

### Get Unit Details
```
GET /course/:courseId/section/:sectionId/unit/:unitId
```

**Multiple Units:** You can combine multiple units by separating their IDs with `+` signs:
```
GET /course/:courseId/section/:sectionId/unit/:unitId1+unitId2+unitId3
```

### Pick Random Questions from a Unit
```
GET /course/:courseId/section/:sectionId/unit/:unitId/pick/:number
```

**Multiple Units:** You can pick questions from multiple units by separating their IDs with `+` signs:
```
GET /course/:courseId/section/:sectionId/unit/:unitId1+unitId2/pick/:number
```

### List Tasks in a Unit
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task
```

### Get Task Details
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId
```

**Multiple Tasks:** You can combine multiple tasks by separating their IDs with `+` signs:
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2+taskId3
```

### Pick Random Questions from a Task
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId/pick/:number
```

**Multiple Tasks:** You can pick questions from multiple tasks by separating their IDs with `+` signs:
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2/pick/:number
```

## Example Usage

1. Get all sections in course 1:
```
GET /course/1/section
```

2. Get all units in section 2 of course 1:
```
GET /course/1/section/2/unit
```

3. Pick 10 random questions from unit 1 in section 2 of course 1:
```
GET /course/1/section/2/unit/1/pick/10
```

4. Pick 5 random questions from units 1 and 2 in section 2 of course 1:
```
GET /course/1/section/2/unit/1+2/pick/5
```

5. Get details for tasks 2 and 3 in unit 1, section 2, course 1:
```
GET /course/1/section/2/unit/1/task/2+3
```

6. Pick 3 random questions from tasks 2 and 3 in unit 1, section 2, course 1:
```
GET /course/1/section/2/unit/1/task/2+3/pick/3
```

## Response Format

All endpoints return JSON responses. For list endpoints (without an ID at the end), the response includes an array of objects with `id` and `name` properties.

Example response for `/course/1/section`:
```json
[
    {
        "id": 1,
        "name": "Section1"
    },
    {
        "id": 2,
        "name": "Section2"
    }
]
```

For detail endpoints (with an ID at the end), the response includes the full object with all its properties.

### Multiple Resource Responses

When requesting multiple resources (using `+` separated IDs), the API returns a combined response:

**Multiple Units:**
```json
{
    "id": "1+2",
    "name": "Combined Units: Unit1, Unit2",
    "units": [...]
}
```

**Multiple Tasks:**
```json
{
    "id": "2+3",
    "name": "Combined Tasks: Task2, Task3",
    "tasks": [...],
    "hierarchy": {...}
}
```

## Rate Limiting

The API includes rate limiting to prevent abuse:
- **Limit:** 100 requests per minute per IP address
- **Window:** 1 minute
- **Headers:** Rate limit information is included in response headers 