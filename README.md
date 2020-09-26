# hcmhsm-crawler

## Knowledge

- Cheerio, should use ```.text()``` instead ```.html()``` to avoid html string is encoded (entities html issues)
- Avoid using ```Promise.all``` in many request network, should use ```Recursive```
  - Example, a studentIds array has 1000 id
    - **Promise.all**
  
    ```js
        async function fetchStudents(studentIds) {
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

- Paging id range for a huge quantity of request (about 10000 request).
  - Examle has 74.560 request, should paging it to ranges
    - One Range has 100 ids, so has 745 ranges

- ```'0'.repeat(integer)```

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
