const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const schedule = require('node-schedule');

const app = express();
const port = 3300;

// 设置Multer中间件，用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use('/work', express.static(path.join(__dirname, 'public')));

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

    // 过滤
    const filters = convertFilters(JSON.parse((req.body.filters)))

    const sheetData = getSheetData(worksheet)
    const workTimeDetailAfterFilter = getWorkTimeDetail(sheetData, filters)

    // 发送JSON数据作为响应
    res.json(workTimeDetailAfterFilter);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing the Excel file.');
  }
});

const dateField= '时间'
const dutyField = '班次'
const timesField = '打卡次数(次)'
const checkedStatusField = '校准状态'
const standardWorkTimeField = '标准工作时长(小时)'
const workTimeField = '实际工作时长(小时)'

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

function convertFilters({ duty, checkedStatus, times }) {
  const filters = {
    [dutyField]: undefined,
    [checkedStatusField]: undefined,
    [timesField]: undefined,
  }

  if (duty) {
    switch (duty) {
      case '非休息':
        filters[dutyField] = (t) => t !== '休息'
        break;
      default:
        break;
    }
  }

  if (checkedStatus) {
    switch (checkedStatus) {
      case '正常':
        filters[checkedStatusField] = (t) => t === '正常'
        break;
      case '非请假休息':
        filters[checkedStatusField] = (t) => !t.includes('请假') && !t.includes('休息')
        break;
      default:
        break;
    }
  }


  if (times) {
    switch (times) {
      case '2':
        filters[timesField] = (t) => t === 2
        break;
      default:
        break;
    }
  }

  return filters;
}

function filterItemWithFilters(item, filters) {
  return Object.keys(filters).every(field => {
    const filter = filters[field]
    return filter ? filter(item[field]) : true
  })
}

function getWorkTimeDetail(workTimeList, filters) {
  // 过滤数据
  const checkedWorkTimeList = workTimeList.filter(item => {
    return filterItemWithFilters(item, filters)
  })

  // 标准工作时长 name

  const standardWorkTimeDaily = checkedWorkTimeList[0] ? Number(checkedWorkTimeList[0][standardWorkTimeField]) : 9 // 默认时长

  // 实际工作时长 name


  const workDays = checkedWorkTimeList.length

  const standardWorkTimeTotal = standardWorkTimeDaily * workDays


  const workDateList = checkedWorkTimeList.map(item => {
    const numberfyWorkTime = Number(item[workTimeField])
    const defaultWorkTime = item[timesField] === 2 ? 0 : standardWorkTimeDaily
    return {
      date: item[dateField],
      time: !Number.isNaN(numberfyWorkTime) ? numberfyWorkTime : defaultWorkTime
    }
  })
  const workTimeTotal = Number(
    workDateList.map(item => item.time).reduce((pre, cur) => {
      return pre + cur
    },
      0
    ).toFixed(2))

  const workTimeDaily = Number((workTimeTotal / workDays).toFixed(2))

  const overWorkTime = Number((workTimeTotal - standardWorkTimeTotal).toFixed(2))

  return {
    '工作天数': workDays,
    [`每日${standardWorkTimeField}`]: standardWorkTimeDaily,
    [`平均${workTimeField}`]: workTimeDaily,
    [`每日${workTimeField}`]: workDateList.map(item => `${item.date} ${item.time}小时`).join(', '),
    [`累计${standardWorkTimeField}`]: standardWorkTimeTotal,
    [`累计${workTimeField}`]: workTimeTotal,
    [`累计${workTimeField}差额`]: overWorkTime
  }
}

// 定时重启
schedule.scheduleJob('5 0 * * *', () => {
  console.log('Daily restart job running...');
  restartExpressApp();
});

function restartExpressApp() {
  console.log('Gracefully shutting down Express app...');
  // Close the server
  server.close(() => {
    console.log('Express app closed. Restarting...');

    // Restart the Express app
    startExpressApp();
  });
}

function startExpressApp() {
  // Start the server
  server = app.listen(port, () => {
    console.log(`Express app is running on http://localhost:${port}, index page: http://localhost:${port}/work`);
  });
}

let server;
startExpressApp();
