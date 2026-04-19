using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace RBX_Alt_Manager.Classes
{
    internal class NBTabControl : TabControl
    {
        private Container components = null;

        public NBTabControl()
        {
            InitializeComponent();

            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.DoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && components != null)
                components.Dispose();

            base.Dispose(disposing);
        }

        private void InitializeComponent() =>
            components = new Container();

        [StructLayout(LayoutKind.Sequential)]
        private struct NMHDR
        {
            public IntPtr HWND;
            public uint idFrom;
            public int code;
        }

        private const int TCN_FIRST = -550;
        private const int TCN_SELCHANGING = TCN_FIRST - 2;
        private const int WM_USER = 0x400;
        private const int WM_NOTIFY = 0x4E;
        private const int WM_REFLECT = WM_USER + 0x1C00;

        private Color m_Backcolor = Color.Empty;

        [Browsable(true), Description("The background color used to display text and graphics in a control.")]
        public override Color BackColor
        {
            get
            {
                if (m_Backcolor.Equals(Color.Empty))
                    return Parent == null ? Control.DefaultBackColor : Parent.BackColor;

                return m_Backcolor;
            }
            set
            {
                if (m_Backcolor.Equals(value))
                    return;

                m_Backcolor = value;
                Invalidate();
                base.OnBackColorChanged(EventArgs.Empty);
            }
        }

        public bool ShouldSerializeBackColor() => !m_Backcolor.Equals(Color.Empty);

        public override void ResetBackColor()
        {
            m_Backcolor = Color.Empty;
            Invalidate();
        }

        protected override void OnParentBackColorChanged(EventArgs e)
        {
            base.OnParentBackColorChanged(e);
            Invalidate();
        }

        protected override void OnSelectedIndexChanged(EventArgs e)
        {
            base.OnSelectedIndexChanged(e);
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.Clear(BackColor);

            if (TabCount <= 0 || SelectedIndex < 0)
                return;

            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

            using StringFormat sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            using SolidBrush textBrush = new SolidBrush(TabPages[SelectedIndex].ForeColor);

            Rectangle selectedBounds = SelectedTab.Bounds;
            selectedBounds.Inflate(2, 2);

            using (GraphicsPath pagePath = CreateRoundedRectangle(selectedBounds, 8))
            using (SolidBrush pageBrush = new SolidBrush(TabPages[SelectedIndex].BackColor))
            using (Pen pagePen = new Pen(ControlPaint.Light(TabPages[SelectedIndex].BackColor, 0.12f)))
            {
                e.Graphics.FillPath(pageBrush, pagePath);
                e.Graphics.DrawPath(pagePen, pagePath);
            }

            for (int index = 0; index < TabCount; index++)
                PaintTabButton(index, e, textBrush, sf);
        }

        private void PaintTabButton(int index, PaintEventArgs e, SolidBrush textBrush, StringFormat sf)
        {
            TabPage tp = TabPages[index];
            Rectangle bounds = Rectangle.Inflate(GetTabRect(index), -2, -2);
            bool isSelected = index == SelectedIndex;
            Color fill = isSelected ? tp.BackColor : ControlPaint.Dark(tp.BackColor, 0.08f);
            Color border = isSelected ? ControlPaint.Light(fill, 0.18f) : ControlPaint.Light(fill, 0.08f);

            using (GraphicsPath tabPath = CreateRoundedRectangle(bounds, 8))
            using (SolidBrush tabBrush = new SolidBrush(fill))
            using (Pen tabPen = new Pen(border))
            {
                e.Graphics.FillPath(tabBrush, tabPath);
                e.Graphics.DrawPath(tabPen, tabPath);
            }

            textBrush.Color = tp.ForeColor;
            Rectangle textBounds = bounds;

            if (Alignment == TabAlignment.Left || Alignment == TabAlignment.Right)
            {
                float rotateAngle = Alignment == TabAlignment.Left ? 270 : 90;
                PointF centerPoint = new PointF(bounds.Left + (bounds.Width >> 1), bounds.Top + (bounds.Height >> 1));
                e.Graphics.TranslateTransform(centerPoint.X, centerPoint.Y);
                e.Graphics.RotateTransform(rotateAngle);
                textBounds = new Rectangle(-(bounds.Height >> 1), -(bounds.Width >> 1), bounds.Height, bounds.Width);
            }

            if (tp.Enabled)
                e.Graphics.DrawString(tp.Text, Font, textBrush, textBounds, sf);
            else
                ControlPaint.DrawStringDisabled(e.Graphics, tp.Text, Font, tp.BackColor, textBounds, sf);

            e.Graphics.ResetTransform();
        }

        private static GraphicsPath CreateRoundedRectangle(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            Rectangle arc = new Rectangle(bounds.Location, new Size(diameter, diameter));
            GraphicsPath path = new GraphicsPath();

            path.AddArc(arc, 180, 90);
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();

            return path;
        }

        [Description("Occurs as a tab is being changed.")]
        public event SelectedTabPageChangeEventHandler SelectedIndexChanging;

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == (WM_REFLECT + WM_NOTIFY))
            {
                NMHDR hdr = (NMHDR)Marshal.PtrToStructure(m.LParam, typeof(NMHDR));

                if (hdr.code == TCN_SELCHANGING)
                {
                    TabPage tp = TestTab(PointToClient(Cursor.Position));

                    if (tp != null)
                    {
                        TabPageChangeEventArgs e = new TabPageChangeEventArgs(SelectedTab, tp);
                        SelectedIndexChanging?.Invoke(this, e);

                        if (e.Cancel || tp.Enabled == false)
                        {
                            m.Result = new IntPtr(1);
                            return;
                        }
                    }
                }
            }

            base.WndProc(ref m);
        }

        private TabPage TestTab(Point pt)
        {
            for (int index = 0; index < TabCount; index++)
                if (GetTabRect(index).Contains(pt.X, pt.Y))
                    return TabPages[index];

            return null;
        }
    }

    public class TabPageChangeEventArgs : EventArgs
    {
        private TabPage _Selected = null;
        private TabPage _PreSelected = null;
        public bool Cancel = false;

        public TabPage CurrentTab => _Selected;
        public TabPage NextTab => _PreSelected;

        public TabPageChangeEventArgs(TabPage CurrentTab, TabPage NextTab)
        {
            _Selected = CurrentTab;
            _PreSelected = NextTab;
        }
    }

    public delegate void SelectedTabPageChangeEventHandler(Object sender, TabPageChangeEventArgs e);
}
