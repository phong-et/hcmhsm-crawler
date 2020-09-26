# hcmhsm-crawler

## Knowledge

- Cheerio, should ```.text()``` instead ```.html()``` avoid encode entities html string
- Avoid using ```Promise.all``` in many request network, should use ```Recursive```
  - Example have array studentIds = [] 1000 id
    - **Promise.all**
  
    ```js
        async function fetchGTStudents(studentIds) {
            await Promise.all(
                studentIds.map(async (studentId) => {
                await delay(1000);
                students.push(
                    generateStudentHtmlToJson(await fetchStudent(studentId), studentId)
                );
                })
            );
            return students;
        }

    ```

    - **Recursive**
  
    ```js
        async function fetchStudentsRecursive(startId, studentIds,
        students
        ) {
            let startStudentId = genStudentIdByInt(startId);
            await delay(timeOutEachId * 1000);
            return fetchStudent(startStudentId).then(async student => {
                students.push(generateStudentHtmlToJson(student, startStudentId));
                startId++;
                if (startId <= studentIds.lenght -1)
                return await fetchStudentsRecursive(startId, studentIds, students);
                else return students;
            });
        }
    ```

- Paging small number request for request a huge number request network (about 10000 request)


## Util functions

```js
function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
```

### Fetch All
