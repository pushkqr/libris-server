const cors = require("cors");
const express = require("express");
const Book = require("./models/book");
const booksRouter = require("./routes/booksRouter");
// const bookRouter = require("./routes/bookRouter");
const {
  errorController,
  notFoundController,
} = require("./controllers/errorController");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// const books = [
//   {
//     title: "Operating System Concepts",
//     author: "Abraham Silberschatz",
//     overview:
//       "Keep pace with the fast–developing world of operating systems Open–source operating systems, virtual machines, and clustered computing are among the leading fields of operating systems and networking that are rapidly changing. With substantial revisions and organizational changes, Silberschatz, Galvin, and Gagne’s Operating System Concepts, Eighth Edition remains as current and relevant as ever, helping you master the fundamental concepts of operating systems while preparing yourself for today’s emerging developments. As in the past, the text brings you up to speed on core knowledge and skills, including: What operating systems are, what they do, and how they are designed and constructed Process, memory, and storage management Protection and security Distributed systems Special–purpose systems Beyond the basics, the Eight Edition sports substantive revisions and organizational changes that clue you in to such cutting–edge developments as open–source operating systems, multi–core processors, clustered computers, virtual machines, transactional memory, NUMA, Solaris 10 memory management, Sun’s ZFS file system, and more. New to this edition is the use of a simulator to dynamically demonstrate several operating system topics. Best of all, a greatly enhanced WileyPlus, a multitude of new problems and programming exercises, and other enhancements to this edition all work together to prepare you enter the world of operating systems with confidence.",
//     coverUrl: "https://covers.openlibrary.org/b/id/302591-L.jpg",
//     isbn: "9780471250609",
//     year: "1988",
//     genre: ["Computers", "Operating Systems"],
//     pages: "900",
//   },
//   {
//     title: "Modern Operating Systems",
//     author: "Andrew S. Tanenbaum, Herbert Bos",
//     overview:
//       "Modern Operating Systems, Fourth Edition, is intended for introductory courses in Operating Systems in Computer Science, Computer Engineering, and Electrical Engineering programs. It also serves as a useful reference for OS professionals. The widely anticipated revision of this worldwide best-seller incorporates the latest developments in operating systems (OS) technologies. The Fourth Edition includes up-to-date materials on relevant OS. Tanenbaum also provides information on current research based on his experience as an operating systems researcher. Modern Operating Systems, Third Edition was the recipient of the 2010 McGuffey Longevity Award. The McGuffey Longevity Award recognizes textbooks whose excellence has been demonstrated over time. This program will provide a better teaching and learning experience–for you and your students. It will help: Provide Practical Detail on the Big Picture Concepts: A clear and entertaining writing style outlines the concepts every OS designer needs to master. Keep Your Course Current: This edition includes information on the latest OS technologies and developments. Enhance Learning with Student and Instructor Resources: Students will gain hands-on experience using the simulation exercises and lab experiments.",
//     coverUrl: "https://covers.openlibrary.org/b/id/9378721-L.jpg",
//     isbn: "9789867790934",
//     year: "1992",
//     genre: ["Computer Science", "Operating Systems"],
//     pages: "1040",
//   },
//   {
//     title: "Advanced concepts in operating systems",
//     author: "Mukesh Singhal",
//     overview:
//       "Comprehensive, and useful as a text and reference, Advanced Concepts in Operating Systems lays down all the concepts and mechanisms involved in the design of operating systems. It is designed for advanced courses in operating systems, including distributed systems, taught in computer science.",
//     coverUrl: "https://covers.openlibrary.org/b/id/5349242-L.jpg",
//     isbn: "007057572X",
//     year: "1994",
//     genre: ["Computer Science", "Operating Systems"],
//     pages: "522",
//   },
//   {
//     title: "Operating systems",
//     author: "William Stallings",
//     overview:
//       "This book provides a comprehensive and unified introduction to operating systems. The book emphasizes both fundamental principles and design issues in contemporary systems. Thus it is both a basic reference and an up-to-date survey of the state of the art. The book provides the reader with a solid understanding of the key mechanisms of modern operating systems and the types of design trade-offs and decisions involved in OS design. In addition to providing coverage of the fundamentals of operating systems, this book examines the most important recent developments in OS design. Among the topics covered: threads, distributed systems, real time systems, process migration, multiprocessor scheduling, and security.",
//     coverUrl: "https://covers.openlibrary.org/b/id/3887043-L.jpg",
//     isbn: "9780136006329",
//     year: "1992",
//     genre: [
//       "Operating Systems",
//       "Computer Security",
//       "Computer Networking",
//       "Computer Architecture",
//     ],
//     pages: "780",
//   },
//   {
//     title: "Schaum's outline of operating systems",
//     author: "J. Archer Harris.",
//     overview:
//       "A comprehensive study guide offering essential operating systems concepts with practice problems, solved examples, and in-depth explanations to help students. It presents all the essential course information in an easy-to-follow, topic-by-topic format, including hundreds of examples and solved problems. It covers the fundamental design principles common to all modern operating systems, including UNIX, Linux, and DOS.",
//     coverUrl: "https://covers.openlibrary.org/b/id/12460132-L.jpg",
//     isbn: "9780071364355",
//     year: "2002",
//     genre: ["Computer Science", "Operating Systems", "Education"],
//     pages: "234",
//   },
// ];

// books.forEach((b) => {
//   const book = new Book(b);
//   book.save();
//   console.log(book.getId());
// });

app.use("/api/v2/books", booksRouter);
app.use(errorController);
app.use(notFoundController);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
