const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const port = 3300;

// 设置Multer中间件，用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 设置路由处理文件上传
app.post('/workInfo', upload.single('excelFile'), (req, res) => {
  try {
    // 从请求中获取Excel文件的Buffer
    const excelBuffer = req.file.buffer;

    // 使用xlsx库解析Excel文件
    const workbook = xlsx.read(excelBuffer, { type: 'buffer' });

    // 获取Excel文件的第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const sheetData = getSheetData(worksheet)
    const workTimeDetail = getWorkTimeDetail(sheetData)

    // 发送JSON数据作为响应
    res.json(workTimeDetail);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing the Excel file.');
  }
});

// 合并前两行的数据
function mergeRows(row1, row2) {
  const mergedData = [];
  const header = row1;
  const values = row2;

  for (let i = 0; i < header.length; i++) {
    const value = !!values[i] ? values[i] : header[i];
    mergedData.push(value);
  }

  return mergedData;
}


function getSheetData(worksheet) {
  // 获取表头范围
  const headerStartRow = 2; // 从第三行开始

  // 将工作表转换为JSON对象，仅转换指定范围
  const headers = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: headerStartRow });
  const [header1, header2] = headers
  const fullHeader = mergeRows(header1, header2)

  // 获取数据范围
  const valueStartRow = 4; // 从第五行开始

  // 将工作表转换为JSON对象，仅转换指定范围
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: fullHeader, range: valueStartRow });

  return jsonData
}

function getWorkTimeDetail(workTimeList) {
  // 过滤校准状态正常的数据
  const checkedStatusField = '校准状态'
  const checkedWorkTimeList = workTimeList
    .filter(item => {
      return item[checkedStatusField] === '正常'
    })
  // 标准工作时长 name
  const standardWorkTimeField = '标准工作时长(小时)'
  const standardWorkTimeDaily = checkedWorkTimeList[0] ? Number(checkedWorkTimeList[0][standardWorkTimeField]) : 9 // 默认时长

  // 实际工作时长 name
  const workTimeField = '实际工作时长(小时)'

  const workDays = checkedWorkTimeList.length

  const standardWorkTimeTotal = standardWorkTimeDaily * workDays

  const workTimeTotal = Number(
    checkedWorkTimeList.map(item => {
      const numberfyWorkTime = Number(item[workTimeField])
      return !Number.isNaN(numberfyWorkTime) ? numberfyWorkTime : 0
    }
    )
      .reduce((pre, cur) => {
        return pre + cur
      },
        0
      ).toFixed(2))

  const workTimeDaily = Number((workTimeTotal / workDays).toFixed(2))

  return {
    '工作天数': workDays,
    [standardWorkTimeField]: standardWorkTimeDaily,
    [`平均${workTimeField}`]: workTimeDaily,
    [`累计${standardWorkTimeField}`]: standardWorkTimeTotal,
    [`累计${workTimeField}`]: workTimeTotal
  }
}

// 启动Express服务器
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
