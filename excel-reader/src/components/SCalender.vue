<template>
  <div class="calendar-container">
    <div v-if="calendarData.length" class="calendar-weekdays">
      <div class="calendar-day" v-for="(weekday, index) in weekDays" :key="index">
        <div class="calendar-date">{{ weekday }}</div>
      </div>
    </div>
    <div
      v-for="(week, weekIndex) in calendarData"
      :key="weekIndex"
      class="calendar-week"
    >
      <div v-for="(day, dayIndex) in week" :key="dayIndex" class="calendar-day">
        <div v-if="day.hours">
          <div class="calendar-date">{{ day.date.replace(/\w+\//, '') }}</div>
          <div class="calendar-hours">{{ day.hours }} 小时</div>
        </div>
        <div v-else>
          <div class="calendar-placeholder"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

const props = defineProps({
  data: { type: Array as PropType<string[]> ,default: ()=> []},
});

const parsedData = computed(() => {
  return props.data.map((item) => {
    const [date, weekday, hours] = item.split(" ");
    return {
      date,
      weekday,
      hours: hours.replace('小时', ''),
    };
  });
});

const weekDays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期天"];

const localeLongDateFormat = Intl.DateTimeFormat('zh-cn', { year: "numeric", month: "2-digit", day: "2-digit" })
const getLocaleLongDate = (date: Date) => {
  return localeLongDateFormat.format(date)
}
// 构建日历数据
const calendarData = computed(() => {
  if(!parsedData.value.length) return []

   // 工具函数：获取星期一的日期
  const getMonday = (date: Date) => {
    const day = date.getDay(); // 获取星期几（0 表示星期天）
    const diff = day === 0 ? -6 : 1 - day; // 若为星期天，调整到上周一
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  };

  // 工具函数：获取星期天的日期
  const getSunday = (date: Date) => {
    const day = date.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  };

  // 转换源数据为 Map，用于快速查找
  const dateMap = new Map<string, { date: string; hours: string; weekday: string }>();
  parsedData.value.forEach((item) => {
    dateMap.set(item.date, item);
  });

  // 找到第一天和最后一天的日期
  const firstDate = new Date(parsedData.value[0].date);
  console.log(firstDate)
  const lastDate = new Date(parsedData.value[parsedData.value.length - 1].date);

  // 计算起点（第一周的星期一）和终点（最后一周的星期天）
  const startDate = getMonday(firstDate);
  console.log(startDate)
  const endDate = getSunday(lastDate);

  // 生成从起点到终点的完整日期范围
  const dateRange: Array<{ date: string; weekday: string }> = [];
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const dateStr = getLocaleLongDate(currentDate);
    dateRange.push({
      date: dateStr,
      weekday: weekDays[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1], // 处理星期天为最后一天
    });
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }

  // 填充完整数据
  const filledData = dateRange.map((date) => {
    if (dateMap.has(date.date)) {
      const original = dateMap.get(date.date)!;
      return { ...original };
    } else {
      return { date: date.date, hours: "", weekday: date.weekday };
    }
  });

  // 按每 7 天分组为周
  const weeks: Array<{ date: string; hours: string; weekday: string }[]> = [];
  for (let i = 0; i < filledData.length; i += 7) {
    weeks.push(filledData.slice(i, i + 7));
  }

  return weeks;
});
</script>

<style scoped>
.calendar-container {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.calendar-weekdays,.calendar-week {
  display: flex;
}

.calendar-day {
  flex: 1;
  text-align: center;
  border: 1px solid #ddd;
  padding: 10px;
}

.calendar-date {
  font-weight: bold;
}

.calendar-hours {
  color: #555;
}

.calendar-placeholder {
  color: #ccc;
}
</style>
