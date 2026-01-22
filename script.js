const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const layerList = document.querySelector('.layer-list');
const popup = document.getElementById("popup");
const square = document.getElementById("square");
const imageInput = document.getElementById('imageInput');

let objects = JSON.parse(localStorage.getItem('figma_data')) || [];
let selectedObjects = []; 
let isDrawing = false;
let isDragging = false;
let currentTool = 'rect'; 
let startX, startY;
let dragOffsets = [];
let scale = 1;

const fontSizeSelect = document.getElementById("fontSize");
if (fontSizeSelect && fontSizeSelect.options.length === 0) {
    for (let i = 1; i <= 120; i++) {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = i;
        fontSizeSelect.appendChild(opt);
    }
    fontSizeSelect.value = 18;
}

function init() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
   
    objects.forEach(obj => {
        if(obj.type === 'image' && obj.src) {
            obj.imgEl = new Image();
            obj.imgEl.src = obj.src;
            obj.imgEl.onload = () => render();
        }
    });
    render();
    updateLayers();
}
window.addEventListener('load', init);

function getMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isInside(x, y, obj) {
    const left = obj.w < 0 ? obj.x + obj.w : obj.x;
    const top = obj.h < 0 ? obj.y + obj.h : obj.y;
    const width = Math.abs(obj.w || 100);
    const height = Math.abs(obj.h || 30);

    if (obj.type === 'rect' || obj.type === 'image' || obj.type === 'text') {
        return x >= left && x <= left + width && y >= top && y <= top + height;
    }
    if (obj.type === 'circle') {
        const dx = x - (obj.x + obj.w/2);
        const dy = y - (obj.y + obj.h/2);
        return (dx*dx)/(obj.w*obj.w/4) + (dy*dy)/(obj.h*obj.h/4) <= 1;
    }
    return false;
}

canvas.addEventListener('mousedown', (e) => {
    const m = getMouse(e);
    
    const hit = [...objects].reverse().find(obj => isInside(m.x, m.y, obj));

    if (hit && currentTool !== 'sketch') {
        if (e.shiftKey) {
            if (!selectedObjects.includes(hit)) selectedObjects.push(hit);
        } else {
            selectedObjects = [hit];
        }
        isDragging = true;
        dragOffsets = selectedObjects.map(obj => ({ dx: m.x - obj.x, dy: m.y - obj.y }));
        syncSidebar(hit);
    } else {
        
        selectedObjects = [];
        isDrawing = true;
        startX = m.x; startY = m.y;
        
        const newObj = {
            id: Date.now(),
            type: currentTool,
            x: startX, y: startY,
            w: 1, h: 1, 
            fill: "transparent",
            stroke: document.getElementById('strokePicker').value || "#ffffff",
            text: currentTool === 'text' ? prompt("Enter Text:") : "",
            fontSize: document.getElementById('fontSize').value || 18,
            fontFamily: document.getElementById('fontFamily').value || "Arial",
            fontStyle: document.getElementById('fontStyle').value || "normal",
            points: currentTool === 'sketch' ? [{x: m.x, y: m.y}] : []
        };
        objects.push(newObj);
        selectedObjects = [newObj];
    }
    render();
});

canvas.addEventListener('mousemove', (e) => {
    const m = getMouse(e);
    if (isDragging) {
        selectedObjects.forEach((obj, i) => {
            obj.x = m.x - dragOffsets[i].dx;
            obj.y = m.y - dragOffsets[i].dy;
        });
    } else if (isDrawing) {
        const active = selectedObjects[0];
        if (currentTool === 'sketch') {
            active.points.push({x: m.x, y: m.y});
        } else {
            active.w = m.x - startX;
            active.h = m.y - startY;
        }
    }
    if (isDragging || isDrawing) render();
});

canvas.addEventListener('mouseup', () => {
    isDrawing = isDragging = false;
    localStorage.setItem('figma_data', JSON.stringify(objects));
    updateLayers();
});

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(obj => {
        ctx.save();
        ctx.strokeStyle = obj.stroke || "#ffffff";
        ctx.lineWidth = 2;
        
        if (selectedObjects.includes(obj)) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "#3b82f6";
        }

        ctx.fillStyle = (obj.fill === "transparent") ? "rgba(0,0,0,0)" : obj.fill;

        if (obj.type === 'rect') {
            if (obj.fill !== "transparent") ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'circle') {
            ctx.beginPath();
            ctx.ellipse(obj.x + obj.w/2, obj.y + obj.h/2, Math.abs(obj.w/2), Math.abs(obj.h/2), 0, 0, Math.PI*2);
            if (obj.fill !== "transparent") ctx.fill();
            ctx.stroke();
        } else if (obj.type === 'sketch') {
            ctx.beginPath();
            obj.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.stroke();
        } else if (obj.type === 'image' && obj.imgEl) {
            ctx.drawImage(obj.imgEl, obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'text') {
            const weight = (obj.fontStyle === 'bold' || obj.fontStyle === '600') ? 'bold ' : '';
            const style = (obj.fontStyle === 'italic') ? 'italic ' : '';
            ctx.font = `${style}${weight}${obj.fontSize}px ${obj.fontFamily}`;
            ctx.fillStyle = (obj.fill === "transparent") ? obj.stroke : obj.fill; 
            ctx.fillText(obj.text, obj.x, obj.y);
        }
        ctx.restore();
    });
}


imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
            const newImgObj = {
                id: Date.now(),
                type: 'image',
                x: 100, y: 100,
                w: 300, h: 300, 
                src: img.src,
                imgEl: img,
                fill: 'transparent',
                stroke: 'transparent'
            };
            objects.push(newImgObj);
            render();
            updateLayers();
            localStorage.setItem('figma_data', JSON.stringify(objects));
        };
    };
    reader.readAsDataURL(file);
});


document.querySelector('.png').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'design-export.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
});


document.querySelector('.pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'px', [canvas.width, canvas.height]);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    doc.save('design-export.pdf');
});

const updateProp = (prop, val) => {
    selectedObjects.forEach(obj => { obj[prop] = val; });
    render();
    localStorage.setItem('figma_data', JSON.stringify(objects));
};

document.getElementById('widthInput').addEventListener('input', e => updateProp('w', parseInt(e.target.value)));
document.getElementById('heightInput').addEventListener('input', e => updateProp('h', parseInt(e.target.value)));
document.getElementById('colorPicker').addEventListener('input', e => {
    document.getElementById('colorHex').value = e.target.value;
    updateProp('fill', e.target.value);
});
document.getElementById('strokePicker').addEventListener('input', e => {
    document.getElementById('strokeHex').value = e.target.value;
    updateProp('stroke', e.target.value);
});
document.getElementById('fontFamily').addEventListener('change', e => updateProp('fontFamily', e.target.value));
document.getElementById('fontSize').addEventListener('change', e => updateProp('fontSize', e.target.value));
document.getElementById('fontStyle').addEventListener('change', e => updateProp('fontStyle', e.target.value));

square.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.toggle("active");
    const r = square.getBoundingClientRect();
    popup.style.left = (r.left - 35 ) + "px";
    popup.style.top = (r.bottom -170) + "px";
});

document.querySelectorAll('.tool').forEach(t => {
    t.addEventListener('click', () => {
        currentTool = t.dataset.tool;
        if(currentTool === 'image') imageInput.click();
        popup.classList.remove('active');
    });
});

document.querySelector('.ri-delete-bin-7-line').addEventListener('click', () => {
    objects = objects.filter(o => !selectedObjects.includes(o));
    selectedObjects = [];
    render(); updateLayers();
});

document.querySelector('.ri-arrow-go-back-line').addEventListener('click', () => {
    objects.pop();
    render(); updateLayers();
});

function syncSidebar(obj) {
    document.getElementById('widthInput').value = Math.round(obj.w);
    document.getElementById('heightInput').value = Math.round(obj.h);
}

function updateLayers() {
    layerList.innerHTML = objects.map((obj, i) => `
        <div style="padding:15px; border-bottom:1px solid #333; color: ${selectedObjects.includes(obj) ? '#3b82f6' : '#8dc9e5'}; font-size:12px">
            LAYER ${i+1} (${obj.type.toUpperCase()})
        </div>
    `).reverse().join('');
}

function changeTheme() {
    var themeBtn = document.querySelector('.theme');
    var rootElement = document.documentElement;

    const themes = [
        { pri: '#F8F4E1', sec: '#222831', tri1: '#948979', tri2: '#393E46' }, 
        { pri: '#F1EFEC', sec: '#030303', tri1: '#D4C9BE', tri2: '#123458' }, 
        { pri: '#F8F4E1', sec: '#381c0a', tri1: '#FEBA17', tri2: '#74512D' },
        { pri: '#0F172A', sec: '#5e7388', tri1: '#38BDF8', tri2: '#1E293B' }, 
        { pri: '#FDFCF0', sec: '#282828', tri1: '#EBDBB2', tri2: '#A89984' }, 
        { pri: '#1E1E2E', sec: '#CDD6F4', tri1: '#89B4FA', tri2: '#313244' }, 
        { pri: '#F3F4F6', sec: '#111827', tri1: '#60A5FA', tri2: '#D1D5DB' }, 
        { pri: '#2E3440', sec: '#6d63a3', tri1: '#88C0D0', tri2: '#4C566A' }, 
        { pri: '#1A1A1A', sec: '#463a3a', tri1: '#FFD700', tri2: '#333333' }, 
        { pri: '#FAF9F6', sec: '#4A4A4A', tri1: '#C2B280', tri2: '#E1D9D1' }, 
        { pri: '#0D0D0D', sec: '#e9da87a9', tri1: '#FF0055', tri2: '#1A1A1A' }, 
        { pri: '#FFF5F5', sec: '#742A2A', tri1: '#FEB2B2', tri2: '#F56565' }, 
        { pri: '#E0F2F1', sec: '#004D40', tri1: '#4DB6AC', tri2: '#B2DFDB' }, 
        { pri: '#282C34', sec: '#ABB2BF', tri1: '#61AFEF', tri2: '#21252B' }, 
        { pri: '#F0EAD6', sec: '#5C4033', tri1: '#A67B5B', tri2: '#ECB176' }, 
        { pri: '#E6E9EF', sec: '#4C4F69', tri1: '#7287FD', tri2: '#DCE0E8' }, 
        { pri: '#24292E', sec: '#84bcf5', tri1: '#0366D6', tri2: '#F6F8FA' }, 
        { pri: '#121212', sec: '#BB86FC', tri1: '#03DAC6', tri2: '#1F1F1F' }, 
        { pri: '#FFFFFF', sec: '#1A1A1B', tri1: '#0079D3', tri2: '#3d464f' }, 
        { pri: '#002B36', sec: '#839496', tri1: '#268BD2', tri2: '#073642' }  
    ];

    var flag = 0;

    themeBtn.addEventListener('click', function () {
        
        const themeData = themes[flag];
        rootElement.style.setProperty('--pri', themeData.pri);
        rootElement.style.setProperty('--sec', themeData.sec);
        rootElement.style.setProperty('--tri1', themeData.tri1);
        rootElement.style.setProperty('--tri2', themeData.tri2);
        flag = (flag + 1) % themes.length;
    });
}

changeTheme()